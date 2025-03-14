/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { ContainerSchema, IFluidContainer } from "fluid-framework";

import { start } from "./infra/authHelper.js"; // eslint-disable-line import/no-internal-modules

const { client, containerId: _containerId } = await start();

export async function createContainer<T extends ContainerSchema>(
	containerSchema: T,
): Promise<IFluidContainer<T>> {
	const { container } = await client.createContainer(containerSchema);
	return container;
}
