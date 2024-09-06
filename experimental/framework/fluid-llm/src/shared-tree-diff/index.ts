export {
	type DifferenceCreate,
	type DifferenceChange,
	type DifferenceMove,
	type DifferenceRemove,
	type Difference,
	sharedTreeDiff,
	createMergableIdDiffSeries,
	createMergableDiffSeries,
} from "./sharedTreeDiff.js";

export { SharedTreeBranchManager } from "./sharedTreeBranchManager.js";

export { sharedTreeTraverse, isTreeArrayNode, isTreeMapNode } from "./utils.js";