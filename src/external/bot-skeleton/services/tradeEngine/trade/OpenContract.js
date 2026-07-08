import { getRoundedNumber } from '@/components/shared';
import { api_base } from '../../api/api-base';
import { contract as broadcastContract, contractStatus } from '../utils/broadcast';
import { openContractReceived, sell } from './state/actions';

export default Engine =>
    class OpenContract extends Engine {
        observeOpenContract() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'proposal_open_contract') {
                    const contract = data.proposal_open_contract;

                    if (!contract || !this.expectedContractId(contract?.contract_id)) {
                        return;
                    }

                    this.setContractFlags(contract);

                    this.data.contract = contract;

                    broadcastContract({ accountID: api_base.account_info.loginid, ...contract });

                    const is_sold = Boolean(contract.is_sold);

                    if (is_sold) {
                        // ── Bulk mode ─────────────────────────────────────────────────
                        if (this.bulkContractIds && this.bulkContractIds.length > 0) {
                            if (!this.bulkSettledIds) this.bulkSettledIds = new Set();
                            this.bulkSettledIds.add(contract.contract_id);

                            clearTimeout(this.transaction_recovery_timeout);
                            this.updateTotals(contract);
                            contractStatus({
                                id: 'contract.sold',
                                data: contract.transaction_ids.sell,
                                contract,
                            });

                            // Only advance engine once ALL bulk contracts have settled
                            if (this.bulkSettledIds.size >= this.bulkContractIds.length) {
                                this.bulkContractIds  = [];
                                this.bulkSettledIds   = new Set();
                                this.bulkTotalCount   = 0;
                                this.bulkSettledCount = 0;
                                this.contractId       = '';

                                if (this.afterPromise) {
                                    this.afterPromise();
                                }
                                this.store.dispatch(sell());
                            }
                        } else {
                            // ── Single-contract (normal) mode ─────────────────────────
                            this.contractId = '';
                            clearTimeout(this.transaction_recovery_timeout);
                            this.updateTotals(contract);
                            contractStatus({
                                id: 'contract.sold',
                                data: contract.transaction_ids.sell,
                                contract,
                            });

                            if (this.afterPromise) {
                                this.afterPromise();
                            }

                            this.store.dispatch(sell());
                        }
                    } else {
                        this.store.dispatch(openContractReceived());
                    }
                }
            });
            api_base.pushSubscription(subscription);
        }

        waitForAfter() {
            return new Promise(resolve => {
                this.afterPromise = resolve;
            });
        }

        setContractFlags(contract) {
            const { is_expired, is_valid_to_sell, is_sold, entry_tick } = contract;

            // In bulk mode isSold is tracked per-contract via bulkSettledIds
            if (!this.bulkContractIds || this.bulkContractIds.length === 0) {
                this.isSold = Boolean(is_sold);
            }
            this.isSellAvailable = !Boolean(is_sold) && Boolean(is_valid_to_sell);
            this.isExpired       = Boolean(is_expired);
            this.hasEntryTick    = Boolean(entry_tick);
        }

        expectedContractId(contractId) {
            // Bulk mode: accept any of the tracked bulk contract IDs
            if (this.bulkContractIds && this.bulkContractIds.length > 0) {
                return this.bulkContractIds.includes(contractId);
            }
            return this.contractId && contractId === this.contractId;
        }

        getSellPrice() {
            const { bid_price: bidPrice, buy_price: buyPrice, currency } = this.data.contract;
            return getRoundedNumber(Number(bidPrice) - Number(buyPrice), currency);
        }
    };
