/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	IDeltaManager,
	ContainerWarning,
} from "@fluidframework/container-definitions/internal";
import type {
	ISummarizerEvents,
	SummarizerStopReason,
} from "@fluidframework/container-runtime-definitions/internal";
import {
	IEventProvider,
	ITelemetryBaseProperties,
	ITelemetryBaseLogger,
} from "@fluidframework/core-interfaces";
import { ISummaryTree } from "@fluidframework/driver-definitions";
import {
	IDocumentMessage,
	ISequencedDocumentMessage,
} from "@fluidframework/driver-definitions/internal";
import { ISummaryStats } from "@fluidframework/runtime-definitions/internal";
import {
	ITelemetryLoggerExt,
	ITelemetryLoggerPropertyBag,
} from "@fluidframework/telemetry-utils/internal";

import type { SummarizeReason } from "./summarizerUtils.js";
import type {
	EnqueueSummarizeResult,
	ISummarizeResults,
} from "./summaryDelayLoadedModule/index.js";

export const summarizerClientType = "summarizer";

/**
 * Similar to AbortSignal, but using promise instead of events
 * @param T - cancellation reason type
 * @internal
 */
export interface ICancellationToken<T> {
	/**
	 * Tells if this cancellable token is cancelled
	 */
	readonly cancelled: boolean;
	/**
	 * Promise that gets fulfilled when this cancellable token is cancelled
	 * @returns reason of cancellation
	 */
	readonly waitCancelled: Promise<T>;
}

/**
 * Similar to AbortSignal, but using promise instead of events
 * @internal
 */
export type ISummaryCancellationToken = ICancellationToken<SummarizerStopReason>;

/**
 * Data required to update internal tracking state after receiving a Summary Ack.
 * @internal
 */
export interface IRefreshSummaryAckOptions {
	/**
	 * Handle from the ack's summary op.
	 */
	readonly proposalHandle: string | undefined;
	/**
	 * Handle from the summary ack just received
	 */
	readonly ackHandle: string;
	/**
	 * Reference sequence number from the ack's summary op
	 */
	readonly summaryRefSeq: number;
	/**
	 * Telemetry logger to which telemetry events will be forwarded.
	 */
	readonly summaryLogger: ITelemetryLoggerExt;
}

/**
 * @internal
 */
export interface ISummarizerInternalsProvider {
	/**
	 * Encapsulates the work to walk the internals of the running container to generate a summary
	 */
	submitSummary(options: ISubmitSummaryOptions): Promise<SubmitSummaryResult>;

	/**
	 * Callback whenever a new SummaryAck is received, to update internal tracking state
	 */
	refreshLatestSummaryAck(options: IRefreshSummaryAckOptions): Promise<void>;
}

/**
 * @internal
 */
export interface ISummarizingWarning extends ContainerWarning {
	readonly errorType: "summarizingError";
	readonly logged: boolean;
}

/**
 * @internal
 */
export interface IConnectableRuntime {
	readonly disposed: boolean;
	readonly connected: boolean;
	readonly clientId: string | undefined;
	once(event: "connected" | "disconnected" | "dispose", listener: () => void): this;
}

/**
 * @internal
 */
export interface ISummarizerRuntime extends IConnectableRuntime {
	readonly baseLogger: ITelemetryBaseLogger;
	/**
	 * clientId of parent (non-summarizing) container that owns summarizer container
	 */
	readonly summarizerClientId: string | undefined;
	readonly deltaManager: IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>;
	disposeFn(): void;
	closeFn(): void;
	on(
		event: "op",
		listener: (op: ISequencedDocumentMessage, runtimeMessage?: boolean) => void,
	): this;
	off(
		event: "op",
		listener: (op: ISequencedDocumentMessage, runtimeMessage?: boolean) => void,
	): this;
}

/**
 * Options affecting summarize behavior.
 * @legacy
 * @alpha
 */
export interface ISummarizeOptions {
	/**
	 * True to generate the full tree with no handle reuse optimizations; defaults to false
	 */
	readonly fullTree?: boolean;
}

/**
 * @internal
 */
export interface ISubmitSummaryOptions extends ISummarizeOptions {
	/**
	 * Logger to use for correlated summary events
	 */
	readonly summaryLogger: ITelemetryLoggerExt;
	/**
	 * Tells when summary process should be cancelled
	 */
	readonly cancellationToken: ISummaryCancellationToken;
	/**
	 * Summarization may be attempted multiple times. This tells whether this is the final summarization attempt.
	 */
	readonly finalAttempt?: boolean;
	/**
	 * The sequence number of the latest summary used to validate if summary state is correct before summarizing
	 */
	readonly latestSummaryRefSeqNum: number;
}

/**
 * @legacy
 * @alpha
 */
export interface IOnDemandSummarizeOptions extends ISummarizeOptions {
	/**
	 * Reason for generating summary.
	 */
	readonly reason: string;
	/**
	 * In case of a failure, will attempt to retry based on if the failure is retriable.
	 */
	readonly retryOnFailure?: boolean;
}

/**
 * Options to use when enqueueing a summarize attempt.
 * @legacy
 * @alpha
 */
export interface IEnqueueSummarizeOptions extends IOnDemandSummarizeOptions {
	/**
	 * If specified, The summarize attempt will not occur until after this sequence number.
	 */
	readonly afterSequenceNumber?: number;

	/**
	 * True to override the existing enqueued summarize attempt if there is one.
	 * This will guarantee that this attempt gets enqueued. If override is false,
	 * than an existing enqueued summarize attempt will block a new one from being
	 * enqueued. There can only be one enqueued at a time. Defaults to false.
	 */
	readonly override?: boolean;
}

/**
 * In addition to the normal summary tree + stats, this contains additional stats
 * only relevant at the root of the tree.
 * @legacy
 * @alpha
 */
export interface IGeneratedSummaryStats extends ISummaryStats {
	/**
	 * The total number of data stores in the container.
	 */
	readonly dataStoreCount: number;
	/**
	 * The number of data stores that were summarized in this summary.
	 */
	readonly summarizedDataStoreCount: number;
	/**
	 * The number of data stores whose GC reference state was updated in this summary.
	 */
	readonly gcStateUpdatedDataStoreCount?: number;
	/**
	 * The size of the gc blobs in this summary.
	 */
	readonly gcTotalBlobsSize?: number;
	/**
	 * The number of gc blobs in this summary.
	 */
	readonly gcBlobNodeCount?: number;
	/**
	 * The summary number for a container's summary. Incremented on summaries throughout its lifetime.
	 */
	readonly summaryNumber: number;
}

/**
 * Type for summarization failures that are retriable.
 * @legacy
 * @alpha
 */
export interface IRetriableFailureError extends Error {
	readonly retryAfterSeconds?: number;
}

/**
 * Base results for all submitSummary attempts.
 * @legacy
 * @alpha
 */
export interface IBaseSummarizeResult {
	readonly stage: "base";
	/**
	 * Retriable error object related to failed summarize attempt.
	 */
	readonly error: IRetriableFailureError | undefined;
	/**
	 * Reference sequence number as of the generate summary attempt.
	 */
	readonly referenceSequenceNumber: number;
	readonly minimumSequenceNumber: number;
}

/**
 * Results of submitSummary after generating the summary tree.
 * @legacy
 * @alpha
 */
export interface IGenerateSummaryTreeResult extends Omit<IBaseSummarizeResult, "stage"> {
	readonly stage: "generate";
	/**
	 * Generated summary tree.
	 */
	readonly summaryTree: ISummaryTree;
	/**
	 * Stats for generated summary tree.
	 */
	readonly summaryStats: IGeneratedSummaryStats;
	/**
	 * Time it took to generate the summary tree and stats.
	 */
	readonly generateDuration: number;
}

/**
 * Results of submitSummary after uploading the tree to storage.
 * @legacy
 * @alpha
 */
export interface IUploadSummaryResult extends Omit<IGenerateSummaryTreeResult, "stage"> {
	readonly stage: "upload";
	/**
	 * The handle returned by storage pointing to the uploaded summary tree.
	 */
	readonly handle: string;
	/**
	 * Time it took to upload the summary tree to storage.
	 */
	readonly uploadDuration: number;
}

/**
 * Results of submitSummary after submitting the summarize op.
 * @legacy
 * @alpha
 */
export interface ISubmitSummaryOpResult extends Omit<IUploadSummaryResult, "stage" | "error"> {
	readonly stage: "submit";
	/**
	 * The client sequence number of the summarize op submitted for the summary.
	 */
	readonly clientSequenceNumber: number;
	/**
	 * Time it took to submit the summarize op to the broadcasting service.
	 */
	readonly submitOpDuration: number;
}

/**
 * Strict type representing result of a submitSummary attempt.
 * The result consists of 4 possible stages, each with its own data.
 * The data is cumulative, so each stage will contain the data from the previous stages.
 * If the final "submitted" stage is not reached, the result may contain the error object.
 *
 * Stages:
 *
 * 1. "base" - stopped before the summary tree was even generated, and the result only contains the base data
 *
 * 2. "generate" - the summary tree was generated, and the result will contain that tree + stats
 *
 * 3. "upload" - the summary was uploaded to storage, and the result contains the server-provided handle
 *
 * 4. "submit" - the summarize op was submitted, and the result contains the op client sequence number.
 * @legacy
 * @alpha
 */
export type SubmitSummaryResult =
	| IBaseSummarizeResult
	| IGenerateSummaryTreeResult
	| IUploadSummaryResult
	| ISubmitSummaryOpResult;

/**
 * The stages of Summarize, used to describe how far progress succeeded in case of a failure at a later stage.
 * @legacy
 * @alpha
 */
export type SummaryStage = SubmitSummaryResult["stage"] | "unknown";

/**
 * The data in summarizer result when submit summary stage fails.
 * @legacy
 * @alpha
 */
export interface SubmitSummaryFailureData {
	stage: SummaryStage;
}

/**
 * @legacy
 * @alpha
 */
export type SummarizeResultPart<TSuccess, TFailure = undefined> =
	| {
			success: true;
			data: TSuccess;
	  }
	| {
			success: false;
			data: TFailure | undefined;
			message: string;
			error: IRetriableFailureError;
	  };

/**
 * @legacy
 * @alpha
 */
export interface ISummarizer extends IEventProvider<ISummarizerEvents> {
	/**
	 * Allows {@link ISummarizer} to be used with our {@link @fluidframework/core-interfaces#FluidObject} pattern.
	 */
	readonly ISummarizer?: ISummarizer;

	/*
	 * Asks summarizer to move to exit.
	 * Summarizer will finish current processes, which may take a while.
	 * For example, summarizer may complete last summary before exiting.
	 */
	stop(reason: SummarizerStopReason): void;

	/* Closes summarizer. Any pending processes (summary in flight) are abandoned. */
	close(): void;

	run(onBehalfOf: string): Promise<SummarizerStopReason>;

	/**
	 * Attempts to generate a summary on demand. If already running, takes no action.
	 * @param options - options controlling the summarize attempt
	 * @returns an alreadyRunning promise if a summarize attempt is already in progress,
	 * which will resolve when the current attempt completes. At that point caller can
	 * decide to try again or not. Otherwise, it will return an object containing promises
	 * that resolve as the summarize attempt progresses. They will resolve with success
	 * false if a failure is encountered.
	 */
	summarizeOnDemand(options: IOnDemandSummarizeOptions): ISummarizeResults;
	/**
	 * Enqueue an attempt to summarize after the specified sequence number.
	 * If afterSequenceNumber is provided, the summarize attempt is "enqueued"
	 * to run once an eligible op comes in with sequenceNumber \>= afterSequenceNumber.
	 * @param options - options controlling the summarize attempt
	 * @returns an object containing an alreadyEnqueued flag to indicate if another
	 * summarize attempt has already been enqueued. It also may contain an overridden flag
	 * when alreadyEnqueued is true, that indicates whether this attempt forced the
	 * previous attempt to abort. If this attempt becomes enqueued, it returns an object
	 * containing promises that resolve as the summarize attempt progresses. They will
	 * resolve with success false if a failure is encountered.
	 */
	enqueueSummarize(options: IEnqueueSummarizeOptions): EnqueueSummarizeResult;
}

/**
 * Data about an attempt to summarize used for heuristics.
 */
export interface ISummarizeAttempt {
	/**
	 * Reference sequence number when summary was generated or attempted
	 */
	readonly refSequenceNumber: number;

	/**
	 * Time of summary attempt after it was sent or attempted
	 */
	readonly summaryTime: number;

	/**
	 * Sequence number of summary op
	 */
	summarySequenceNumber?: number;
}

/**
 * Data relevant for summary heuristics.
 */
export interface ISummarizeHeuristicData {
	/**
	 * Latest received op sequence number
	 */
	lastOpSequenceNumber: number;

	/**
	 * Most recent summary attempt from this client
	 */
	readonly lastAttempt: ISummarizeAttempt;

	/**
	 * Most recent summary that received an ack
	 */
	readonly lastSuccessfulSummary: Readonly<ISummarizeAttempt>;

	/**
	 * Number of runtime ops since last summary
	 */
	numRuntimeOps: number;

	/**
	 * Number of non-runtime ops since last summary
	 */
	numNonRuntimeOps: number;

	/**
	 * Cumulative size in bytes of all the ops since the last summary
	 */
	totalOpsSize: number;

	/**
	 * Wether or not this instance contains adjusted metrics due to missing op data
	 */
	hasMissingOpData: boolean;

	/**
	 * Updates lastAttempt and lastSuccessfulAttempt based on the last summary.
	 * @param lastSummary - last ack summary
	 */
	updateWithLastSummaryAckInfo(lastSummary: ISummarizeAttempt): void;

	/**
	 * Records a summary attempt. If the attempt was successfully sent,
	 * provide the reference sequence number, otherwise it will be set
	 * to the last seen op sequence number.
	 * @param referenceSequenceNumber - reference sequence number of sent summary
	 */
	recordAttempt(referenceSequenceNumber?: number): void;

	/**
	 * Mark that the last sent summary attempt has received an ack
	 */
	markLastAttemptAsSuccessful(): void;

	opsSinceLastSummary: number;
}

/**
 * Responsible for running heuristics determining when to summarize.
 */
export interface ISummarizeHeuristicRunner {
	/**
	 * Start specific heuristic trackers (ex: idle timer)
	 */
	start(): void;

	/**
	 * Runs the heuristics to determine if it should try to summarize
	 */
	run(): void;

	/**
	 * Runs a different heuristic to check if it should summarize before closing
	 */
	shouldRunLastSummary(): boolean;

	/**
	 * Disposes of resources
	 */
	dispose(): void;
}

type ISummarizeTelemetryRequiredProperties =
	/**
	 * Reason code for attempting to summarize
	 */
	"summarizeReason";

type ISummarizeTelemetryOptionalProperties =
	/**
	 * Number of attempts within the last time window, used for calculating the throttle delay.
	 */
	| "summaryAttempts"
	/**
	 * Summarization may be attempted multiple times. This tells whether this is the final summarization attempt
	 */
	| "finalAttempt"
	| keyof ISummarizeOptions;

export type ISummarizeTelemetryProperties = Pick<
	ITelemetryBaseProperties,
	ISummarizeTelemetryRequiredProperties
> &
	Partial<Pick<ITelemetryBaseProperties, ISummarizeTelemetryOptionalProperties>>;

/**
 * Strategy used to heuristically determine when we should run a summary
 */
export interface ISummaryHeuristicStrategy {
	/**
	 * Summarize reason for this summarize heuristic strategy (ex: "maxTime")
	 */
	summarizeReason: Readonly<SummarizeReason>;

	/**
	 * Determines if this strategy's summarize criteria been met
	 * @param configuration - summary configuration we are to check against
	 * @param heuristicData - heuristic data used to confirm conditions are met
	 */
	shouldRunSummary(
		configuration: ISummaryConfigurationHeuristics,
		heuristicData: ISummarizeHeuristicData,
	): boolean;
}

type SummaryGeneratorRequiredTelemetryProperties =
	/**
	 * True to generate the full tree with no handle reuse optimizations
	 */
	| "fullTree"
	/**
	 * Time since we last attempted to generate a summary
	 */
	| "timeSinceLastAttempt"
	/**
	 * Time since we last successfully generated a summary
	 */
	| "timeSinceLastSummary";

type SummaryGeneratorOptionalTelemetryProperties =
	/**
	 * Reference sequence number as of the generate summary attempt.
	 */
	| "referenceSequenceNumber"
	/**
	 * minimum sequence number (at the reference sequence number)
	 */
	| "minimumSequenceNumber"
	/**
	 * Delta between the current reference sequence number and the reference sequence number of the last attempt
	 */
	| "opsSinceLastAttempt"
	/**
	 * Delta between the current reference sequence number and the reference sequence number of the last summary
	 */
	| "opsSinceLastSummary"
	/**
	 * Delta in sum of op sizes between the current reference sequence number and the reference
	 * sequence number of the last summary
	 */
	| "opsSizesSinceLastSummary"
	/**
	 * Delta between the number of non-runtime ops since the last summary
	 */
	| "nonRuntimeOpsSinceLastSummary"
	/**
	 * Delta between the number of runtime ops since the last summary
	 */
	| "runtimeOpsSinceLastSummary"
	/**
	 * Wether or not this instance contains adjusted metrics due to missing op data
	 */
	| "hasMissingOpData"
	/**
	 * Time it took to generate the summary tree and stats.
	 */
	| "generateDuration"
	/**
	 * The handle returned by storage pointing to the uploaded summary tree.
	 */
	| "handle"
	/**
	 * Time it took to upload the summary tree to storage.
	 */
	| "uploadDuration"
	/**
	 * The client sequence number of the summarize op submitted for the summary.
	 */
	| "clientSequenceNumber"
	/**
	 * Time it took for this summary to be acked after it was generated
	 */
	| "ackWaitDuration"
	/**
	 * Reference sequence number of the ack/nack message
	 */
	| "ackNackSequenceNumber"
	/**
	 * Actual sequence number of the summary op proposal.
	 */
	| "summarySequenceNumber"
	/**
	 * Optional Retry-After time in seconds. If specified, the client should wait this many seconds before retrying.
	 */
	| "nackRetryAfter"
	/**
	 * The stage at which the submit summary method failed at. This can help determine what type of failure we have
	 */
	| "stage";

export type SummaryGeneratorTelemetry = Pick<
	ITelemetryBaseProperties,
	SummaryGeneratorRequiredTelemetryProperties
> &
	Partial<Pick<ITelemetryBaseProperties, SummaryGeneratorOptionalTelemetryProperties>>;

export interface ISummarizeRunnerTelemetry extends ITelemetryLoggerPropertyBag {
	/**
	 * Number of times the summarizer run.
	 */
	summarizeCount: () => number;
	/**
	 * Number of successful attempts to summarize.
	 */
	summarizerSuccessfulAttempts: () => number;
}

/**
 * @legacy
 * @alpha
 */
export interface ISummaryBaseConfiguration {
	/**
	 * Delay before first attempt to spawn summarizing container.
	 */
	initialSummarizerDelayMs: number;

	/**
	 * Defines the maximum allowed time to wait for a pending summary ack.
	 * The maximum amount of time client will wait for a summarize is the minimum of
	 * maxSummarizeAckWaitTime (currently 3 * 60 * 1000) and maxAckWaitTime.
	 */
	maxAckWaitTime: number;
	/**
	 * Defines the maximum number of Ops in between Summaries that can be
	 * allowed before forcibly electing a new summarizer client.
	 */
	maxOpsSinceLastSummary: number;
}

/**
 * @legacy
 * @alpha
 */
export interface ISummaryConfigurationHeuristics extends ISummaryBaseConfiguration {
	state: "enabled";
	/**
	 * Defines the maximum allowed time, since the last received Ack, before running the summary
	 * with reason maxTime.
	 * For example, say we receive ops one by one just before the idle time is triggered.
	 * In this case, we still want to run a summary since it's been a while since the last summary.
	 */
	maxTime: number;
	/**
	 * Defines the maximum number of Ops, since the last received Ack, that can be allowed
	 * before running the summary with reason maxOps.
	 */
	maxOps: number;
	/**
	 * Defines the minimum number of Ops, since the last received Ack, that can be allowed
	 * before running the last summary.
	 */
	minOpsForLastSummaryAttempt: number;
	/**
	 * Defines the lower boundary for the allowed time in between summarizations.
	 * Pairs with maxIdleTime to form a range.
	 * For example, if we only receive 1 op, we don't want to have the same idle time as say 100 ops.
	 * Based on the boundaries we set in minIdleTime and maxIdleTime, the idle time will change
	 * linearly depending on the number of ops we receive.
	 */
	minIdleTime: number;
	/**
	 * Defines the upper boundary for the allowed time in between summarizations.
	 * Pairs with minIdleTime to form a range.
	 * For example, if we only receive 1 op, we don't want to have the same idle time as say 100 ops.
	 * Based on the boundaries we set in minIdleTime and maxIdleTime, the idle time will change
	 * linearly depending on the number of ops we receive.
	 */
	maxIdleTime: number;
	/**
	 * Runtime op weight to use in heuristic summarizing.
	 * This number is a multiplier on the number of runtime ops we process when running summarize heuristics.
	 * For example: (multiplier) * (number of runtime ops) = weighted number of runtime ops
	 */
	runtimeOpWeight: number;
	/**
	 * Non-runtime op weight to use in heuristic summarizing
	 * This number is a multiplier on the number of non-runtime ops we process when running summarize heuristics.
	 * For example: (multiplier) * (number of non-runtime ops) = weighted number of non-runtime ops
	 */
	nonRuntimeOpWeight: number;

	/**
	 * Number of ops since last summary needed before a non-runtime op can trigger running summary heuristics.
	 *
	 * Note: Any runtime ops sent before the threshold is reached will trigger heuristics normally.
	 * This threshold ONLY applies to non-runtime ops triggering summaries.
	 *
	 * For example: Say the threshold is 20. Sending 19 non-runtime ops will not trigger any heuristic checks.
	 * Sending the 20th non-runtime op will trigger the heuristic checks for summarizing.
	 */
	nonRuntimeHeuristicThreshold?: number;
}

/**
 * @legacy
 * @alpha
 */
export interface ISummaryConfigurationDisableSummarizer {
	state: "disabled";
}

/**
 * @legacy
 * @alpha
 */
export interface ISummaryConfigurationDisableHeuristics extends ISummaryBaseConfiguration {
	state: "disableHeuristics";
}

/**
 * @legacy
 * @alpha
 */
export type ISummaryConfiguration =
	| ISummaryConfigurationDisableSummarizer
	| ISummaryConfigurationDisableHeuristics
	| ISummaryConfigurationHeuristics;
