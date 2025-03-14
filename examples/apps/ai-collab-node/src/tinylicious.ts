/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { TinyliciousClient } from "@fluidframework/tinylicious-client";
import { IFluidContainer, type ContainerSchema } from "fluid-framework";

const tinyliciousClient = new TinyliciousClient({});

export async function createContainer<T extends ContainerSchema>(
	containerSchema: T,
): Promise<IFluidContainer<T>> {
	const { container } = await tinyliciousClient.createContainer(containerSchema, "2");
	return container;
}
