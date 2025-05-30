/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { DocumentationParentNodeBase } from "./DocumentationNode.js";
import { DocumentationNodeType } from "./DocumentationNodeType.js";
import { PlainTextNode } from "./PlainTextNode.js";

/**
 * Represents a simple, single-line code span.
 *
 * @example Markdown
 *
 * ```md
 * `Foo`
 * ```
 *
 * @example HTML
 *
 * ```html
 * <code>Foo</code>
 * ```
 *
 * @public
 */
export class CodeSpanNode extends DocumentationParentNodeBase<PlainTextNode> {
	/**
	 * Static singleton representing an empty Code Span node.
	 */
	public static readonly Empty: CodeSpanNode = new CodeSpanNode([]);

	/**
	 * {@inheritDoc DocumentationNode."type"}
	 */
	public readonly type = DocumentationNodeType.CodeSpan;

	/**
	 * {@inheritDoc DocumentationNode.singleLine}
	 */
	public override get singleLine(): true {
		return true;
	}

	public constructor(children: PlainTextNode[]) {
		super(children);
	}

	/**
	 * Generates a `CodeSpanNode` from the provided string.
	 * @param text - The node contents. Note: this must not contain newline characters.
	 */
	public static createFromPlainText(text: string): CodeSpanNode {
		return new CodeSpanNode([new PlainTextNode(text)]);
	}
}
