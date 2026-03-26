import { LightningElement, wire } from 'lwc';
import ConnectsIntegrationLibrary from 'cnxscv/connectsIntegrationLibrary';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {
    EnclosingUtilityId,
    setUtilityHighlighted,
    setUtilityLabel,
    setUtilityIcon,
    open,
    minimize
} from 'lightning/platformUtilityBarApi';

const DEFAULT_LABEL = 'Hold Timer';

// Tiered hold thresholds (seconds)
const TIER_CAUTION  = 30;  // Orange toast, amber border
const TIER_ALERT    = 60;  // Red toast, red border + pulse
const TIER_CRITICAL = 90;  // Red sticky toast, fast pulse

export default class HoldTimer extends LightningElement {
    cil;

    // Utility Bar identity — set directly by @wire adapter
    @wire(EnclosingUtilityId) utilityId;

    // Reactive UI properties
    isOnHold = false;
    currentSegmentDisplay = '00:00';
    totalHoldDisplay = '00:00';

    // Tiered warning state: 'none' | 'caution' | 'alert' | 'critical'
    warningTier = 'none';

    // Tracking
    holdStartTime = null;
    cumulativeHoldSeconds = 0;
    currentHoldSeconds = 0;
    holdCount = 0;

    // b+s correlation
    workitemId = null;
    channelId = 'telephony';

    intervalId = null;

    get containerClass() {
        if (this.warningTier === 'critical') return 'hold-container hold-container--critical';
        if (this.warningTier === 'alert') return 'hold-container hold-container--alert';
        if (this.warningTier === 'caution') return 'hold-container hold-container--caution';
        if (this.isOnHold) return 'hold-container hold-container--active';
        return 'hold-container hold-container--idle';
    }

    get isCaution() {
        return this.warningTier === 'caution';
    }

    get isAlert() {
        return this.warningTier === 'alert';
    }

    get isCritical() {
        return this.warningTier === 'critical';
    }

    get hasWarning() {
        return this.warningTier !== 'none';
    }

    get statusLabel() {
        if (this.isOnHold) return 'Customer on Hold';
        if (this.cumulativeHoldSeconds > 0) return 'Call Active — Hold Released';
        return 'Monitoring Calls';
    }

    get showTotalHold() {
        return this.cumulativeHoldSeconds > 0 || this.isOnHold;
    }

    get holdCountLabel() {
        return this.holdCount === 1 ? '1 hold' : `${this.holdCount} holds`;
    }

    get isIdle() {
        return !this.showTotalHold && !this.isOnHold;
    }

    connectedCallback() {
        this.cil = new ConnectsIntegrationLibrary();

        this.cil.initIntegration(() => {
            console.info('[holdTimer] b+s Connects Integration Library ready');
            console.info('[holdTimer] Utility bar ID:', this.utilityId);

            this.cil.onWorkitemConnect((data) => {
                if (this.isVoiceChannel(data)) this.captureWorkitemInfo(data);
            });

            this.cil.onWorkitemPause((data) => {
                if (this.isVoiceChannel(data)) {
                    this.startHoldTimer();
                    this.captureWorkitemInfo(data);
                    console.info('[holdTimer] Hold detected — timer started');
                }
            });

            this.cil.onWorkitemResume((data) => {
                if (this.isVoiceChannel(data)) {
                    this.stopHoldTimer();
                    this.captureWorkitemInfo(data);
                    console.info('[holdTimer] Hold resumed — timer paused');
                }
            });

            this.cil.onWorkitemEnd((data) => {
                if (this.isVoiceChannel(data)) {
                    console.info('[holdTimer] onWorkitemEnd fired');
                    this.finalizeAndReset();
                }
            });

            // Also listen for agent state changes — Wrapup means the voice
            // call has ended, even if onWorkitemEnd hasn't fired yet
            this.cil.onAgentStateChange((data) => {
                const state = data?.newState || data?.state;
                const cid = data?.channelId || data?.channel?.id;
                console.info(`[holdTimer] onAgentStateChange — state: ${state}, channel: ${cid}`);

                if (cid === 'telephony' && (state === 'Wrapup' || state === 'WrapUp' || state === 'WRAPUP')) {
                    console.info('[holdTimer] Wrapup detected — finalizing hold timer');
                    this.finalizeAndReset();
                }
            });

            this.cil.onError((error) => console.error('[holdTimer] b+s Error:', JSON.stringify(error)));
        });
    }

    disconnectedCallback() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.unhighlightUtility();
    }

    captureWorkitemInfo(data) {
        const id = data?.id || data?.workitem?.id;
        if (id && !this.workitemId) {
            this.workitemId = id;
            console.info('[holdTimer] Captured workitemId:', this.workitemId);
        }
    }

    isVoiceChannel(data) {
        if (!data) return false;
        const cid = data.channelId || data.workitem?.channelId || data.channel?.id;
        return cid === 'telephony';
    }

    // ── Utility Bar Controls ──────────────────────────────────────────

    async openUtilityPanel() {
        try {
            if (this.utilityId) {
                await open(this.utilityId, { autoFocus: true });
                console.info('[holdTimer] Utility panel opened');
            }
        } catch (err) {
            console.warn('[holdTimer] open failed:', err);
        }
    }

    async minimizeUtilityPanel() {
        try {
            if (this.utilityId) {
                await minimize(this.utilityId);
                console.info('[holdTimer] Utility panel minimized');
            }
        } catch (err) {
            console.warn('[holdTimer] minimize failed:', err);
        }
    }

    async highlightUtility() {
        try {
            if (this.utilityId) {
                await setUtilityHighlighted(this.utilityId, { highlighted: true });
            }
        } catch (err) {
            console.warn('[holdTimer] setUtilityHighlighted failed:', err);
        }
    }

    async unhighlightUtility() {
        try {
            if (this.utilityId) {
                await setUtilityHighlighted(this.utilityId, { highlighted: false });
            }
        } catch (err) {
            console.warn('[holdTimer] setUtilityHighlighted failed:', err);
        }
    }

    async updateUtilityLabel(label) {
        try {
            if (this.utilityId) {
                await setUtilityLabel(this.utilityId, { label });
            }
        } catch (err) {
            console.warn('[holdTimer] setUtilityLabel failed:', err);
        }
    }

    async updateUtilityIcon(icon) {
        try {
            if (this.utilityId) {
                await setUtilityIcon(this.utilityId, { icon });
            }
        } catch (err) {
            console.warn('[holdTimer] setUtilityIcon failed:', err);
        }
    }

    // ── Timer Logic ───────────────────────────────────────────────────

    showTieredToast(tier) {
        const toasts = {
            caution: {
                title: 'Hold Approaching Limit',
                message: `Customer on hold for ${TIER_CAUTION}s — consider resuming soon.`,
                variant: 'warning',
                mode: 'dismissible'
            },
            alert: {
                title: 'Customer Waiting Too Long!',
                message: `Hold time exceeds ${TIER_ALERT}s — please resume the call.`,
                variant: 'error',
                mode: 'dismissible'
            },
            critical: {
                title: 'HOLD TIME CRITICAL',
                message: `Hold exceeds ${TIER_CRITICAL}s — immediate action required!`,
                variant: 'error',
                mode: 'sticky'
            }
        };

        const config = toasts[tier];
        if (config) {
            this.dispatchEvent(new ShowToastEvent(config));
        }
    }

    checkThresholdTier(seconds) {
        let newTier = 'none';
        if (seconds > TIER_CRITICAL) {
            newTier = 'critical';
        } else if (seconds > TIER_ALERT) {
            newTier = 'alert';
        } else if (seconds > TIER_CAUTION) {
            newTier = 'caution';
        }

        // Only act when escalating to a new tier
        if (newTier !== this.warningTier && newTier !== 'none') {
            this.warningTier = newTier;
            this.highlightUtility();
            this.showTieredToast(newTier);
            console.info(`[holdTimer] Escalated to tier: ${newTier} at ${seconds}s`);
        }
    }

    startHoldTimer() {
        if (this.isOnHold) return;

        this.isOnHold = true;
        this.warningTier = 'none';
        this.currentHoldSeconds = 0;
        this.currentSegmentDisplay = '00:00';
        this.holdStartTime = Date.now();
        this.holdCount += 1;

        console.info('[holdTimer] startHoldTimer — utilityId:', this.utilityId);

        // Utility bar updates (gracefully skipped if not in utility bar)
        this.openUtilityPanel();
        this.highlightUtility();
        this.updateUtilityIcon('utility:pause');
        this.updateUtilityLabel(`${DEFAULT_LABEL}  ⏱ 00:00`);

        this.intervalId = setInterval(() => {
            const elapsedMs = Date.now() - this.holdStartTime;
            this.currentHoldSeconds = Math.floor(elapsedMs / 1000);
            const totalSeconds = this.cumulativeHoldSeconds + this.currentHoldSeconds;

            // Current segment resets each hold; total is cumulative
            this.currentSegmentDisplay = this.formatDuration(this.currentHoldSeconds);
            this.totalHoldDisplay = this.formatDuration(totalSeconds);

            // Live timer in the utility bar tab label
            this.updateUtilityLabel(
                `${DEFAULT_LABEL}  ⏱ ${this.currentSegmentDisplay}`
            );

            // Check for tier escalation (per-segment)
            this.checkThresholdTier(this.currentHoldSeconds);
        }, 1000);
    }

    stopHoldTimer() {
        if (!this.isOnHold) return;

        this.cumulativeHoldSeconds += this.currentHoldSeconds;
        this.isOnHold = false;
        this.warningTier = 'none';
        this.currentHoldSeconds = 0;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.unhighlightUtility();
        this.minimizeUtilityPanel();
        this.totalHoldDisplay = this.formatDuration(this.cumulativeHoldSeconds);
        this.updateUtilityIcon('utility:clock');
        this.updateUtilityLabel(
            `${DEFAULT_LABEL}  ✓ Total: ${this.totalHoldDisplay}`
        );
    }

    finalizeAndReset() {
        // Guard against double-fire (onWorkitemEnd + onAgentStateChange)
        if (!this.isOnHold && this.cumulativeHoldSeconds === 0 && this.holdCount === 0) {
            return;
        }

        if (this.isOnHold) {
            const finalSegment = Math.floor((Date.now() - this.holdStartTime) / 1000);
            this.cumulativeHoldSeconds += finalSegment;
            console.info(`[holdTimer] Call ended while on hold — final segment: ${finalSegment}s, total: ${this.cumulativeHoldSeconds}s`);
        }

        this.resetHoldTimer();
    }

    resetHoldTimer() {
        this.stopHoldTimer();
        this.cumulativeHoldSeconds = 0;
        this.holdCount = 0;
        this.workitemId = null;
        this.currentSegmentDisplay = '00:00';
        this.totalHoldDisplay = '00:00';
        this.unhighlightUtility();
        this.updateUtilityLabel(DEFAULT_LABEL);
        this.updateUtilityIcon('utility:clock');
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // ── b+s Data Sync ─────────────────────────────────────────────────

    async attemptBsUpdate() {
        if (!this.workitemId || this.cumulativeHoldSeconds === 0) {
            console.warn('[holdTimer] No workitemId or hold time — skipping b+s update');
            return;
        }

        try {
            const enabledResp = await this.cil.isUpdateWorkitemDataEnabled(this.channelId, this.workitemId);
            if (!enabledResp?.response?.enabled) {
                console.warn('[holdTimer] updateWorkitemData not enabled for this workitem');
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Hold Sync Skipped',
                    message: 'updateWorkitemData not enabled (API constraint at call end)',
                    variant: 'warning'
                }));
                return;
            }

            const updatedData = { CustomerHoldDuration: this.cumulativeHoldSeconds.toString() };
            await this.cil.updateWorkitemData(this.channelId, this.workitemId, updatedData);

            console.info(`[holdTimer] b+s update successful: CustomerHoldDuration = ${this.cumulativeHoldSeconds}s`);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Hold Duration Synced',
                message: `${this.cumulativeHoldSeconds}s sent via b+s Connects`,
                variant: 'success'
            }));
        } catch (error) {
            console.error('[holdTimer] b+s update failed', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Hold Sync Failed',
                message: 'Check console for details',
                variant: 'error'
            }));
        }
    }
}
