/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

"use client";

// eslint-disable-next-line import/no-internal-modules
import type { IFluidDataStoreRuntime } from "@fluidframework/datastore-definitions/internal";
// eslint-disable-next-line import/no-internal-modules
import { OdspClient } from "@fluidframework/odsp-client/internal";
import type { IFluidContainer, IFluidHandle } from "fluid-framework";
// eslint-disable-next-line import/no-internal-modules -- This is the correct place to get SharedString
import { SharedString } from "fluid-framework/legacy";

/* eslint-disable import/no-internal-modules */
import { getToken } from "./infra/authHelper.js";
import { GraphHelper } from "./infra/graphHelper.js";
import { SampleOdspTokenProvider } from "./infra/tokenProvider.js";
/* eslint-enable import/no-internal-modules */
import {
	CONTAINER_SCHEMA,
	INITIAL_APP_STATE,
	SharedTreeAppState,
	TREE_CONFIGURATION,
} from "./sharedTreeAppSchema.js";

const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
	0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, 0x08, 0x02, 0x00, 0x00, 0x00, 0xfd,
	0xe9, 0x8c, 0xa6, 0x00, 0x00, 0x00, 0x19, 0x74, 0x45, 0x58, 0x74, 0x53, 0x6f, 0x66, 0x74,
	0x77, 0x61, 0x72, 0x65, 0x00, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x20, 0x49, 0x6d, 0x61, 0x67,
	0x65, 0x52, 0x65, 0x61, 0x64, 0x79, 0x71, 0xc9, 0x65, 0x3c, 0x00, 0x00, 0x01, 0x76, 0x49,
	0x44, 0x41, 0x54, 0x78, 0xda, 0xec, 0xd8, 0x31, 0x0e, 0x80, 0x20, 0x0c, 0x03, 0x51, 0xe2,
	0xff, 0x9f, 0x9c, 0x37, 0xa1, 0x86, 0x96, 0x0e, 0x03, 0x66, 0xfd, 0x4b, 0x41, 0xd9, 0x9c,
	0xa4, 0x10, 0xb1, 0xd5, 0x24, 0xf1, 0x80, 0xb3, 0x79, 0xf8, 0x0c, 0x6f, 0x99, 0x20, 0x83,
	0x13, 0x80, 0x30, 0x34, 0x00, 0x02, 0x01, 0x00, 0x8e, 0xfa, 0x28, 0x50, 0xf0, 0xe3, 0x67,
	0x00, 0x04, 0x02, 0x00, 0x1c, 0xf5, 0x51, 0xa0, 0xe0, 0xc7, 0xcf, 0x00, 0x08, 0x04, 0x00,
	0x38, 0xea, 0xa3, 0x40, 0xc1, 0x8f, 0x9f, 0x01, 0x10, 0x08, 0x00, 0x70, 0xd4, 0x47, 0x81,
	0x82, 0x1f, 0x3f, 0x03, 0x20, 0x10, 0x00, 0xe0, 0xa8, 0x8f, 0x02, 0x05, 0x3f, 0x7e, 0x06,
	0x40, 0x20, 0x00, 0xc0, 0x51, 0x1f, 0x05, 0x0a, 0x7e, 0xfc, 0x0c, 0x80, 0x40, 0x00, 0x80,
	0xa3, 0x3e, 0x0a, 0x14, 0xfc, 0xf8, 0x19, 0x00, 0x81, 0x00, 0x00, 0x47, 0x7d, 0x14, 0x28,
	0xf8, 0xf1, 0x33, 0x00, 0x02, 0x01, 0x00, 0x8e, 0xfa, 0x28, 0x50, 0xf0, 0xe3, 0x67, 0x00,
	0x04, 0x02, 0x00, 0x1c, 0xf5, 0x51, 0xa0, 0xe0, 0xc7, 0xcf, 0x00, 0x08, 0x04, 0x00, 0x38,
	0xea, 0xa3, 0x40, 0xc1, 0x8f, 0x9f, 0x01, 0x10, 0x08, 0x00, 0x70, 0xd4, 0x47, 0x81, 0x82,
	0x1f, 0x3f, 0x03, 0x20, 0x10, 0x00, 0xe0, 0xa8, 0x8f, 0x02, 0x05, 0x3f, 0x7e, 0x06, 0x40,
	0x20, 0x00, 0xc0, 0x51, 0x1f, 0x05, 0x0a, 0x7e, 0xfc, 0x0c, 0x80, 0x40, 0x00, 0x80, 0xa3,
	0x3e, 0x0a, 0x14, 0xfc, 0xf8, 0x19, 0x00, 0x81, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
	0x44, 0xae, 0x42, 0x60, 0x82,
]);

const authToken = await getToken();
if (authToken === null) {
	throw new Error("Failed to get token");
}

// Create the GraphHelper instance
// This is used to interact with the Graph API
// Which allows the app to get the file storage container id, the Fluid container id,
// and the site URL.
const graphHelper = new GraphHelper(authToken.accessToken);

// Define a function to get the container info based on the URL hash
// The URL hash is the shared item id and will be used to get the file storage container id
// and the Fluid container id. If there is no hash, then the app will create a new Fluid container
// in a later step.
const getContainerInfo = async (): Promise<
	{ driveId: string; itemId: string } | undefined
> => {
	const shareId = process.env.SHARE_ID ?? "";
	if (shareId.length > 0) {
		try {
			return await graphHelper.getSharedItem(shareId);
		} catch (error) {
			console.error("Error while fetching shared item:", error as string);
			return undefined;
		}
	} else {
		return undefined;
	}
};

// Get the file storage container id (driveId) and the Fluid container id (itemId).
const containerInfo = await getContainerInfo();

// Define a function to get the file storage container id using the Graph API
// If the user doesn't have access to the file storage container, then the app will fail here.
const getFileStorageContainerId = async (): Promise<string> => {
	try {
		return await graphHelper.getFileStorageContainerId();
	} catch (error) {
		console.error("Error while fetching file storage container ID:", error as string);
		return "";
	}
};

let fileStorageContainerId = "";

// If containerInfo is undefined, then get the file storage container id using the function
// defined above.
// If the containerInfo is not undefined, then use the file storage container id and Fluid container id
// from containerInfo.
// eslint-disable-next-line unicorn/prefer-ternary
if (containerInfo === undefined) {
	fileStorageContainerId = await getFileStorageContainerId();
} else {
	fileStorageContainerId = containerInfo.driveId;
	// const containerId = containerInfo.itemId;
}

// If the file storage container id is empty, then the app will fail here.
if (fileStorageContainerId.length === 0) {
	throw new Error("No file storage container id found.");
}

// Create the client properties required to initialize
// the Fluid client instance. The Fluid client instance is used to
// interact with the Fluid service.
const clientProps = {
	connection: {
		siteUrl: await graphHelper.getSiteUrl(),
		tokenProvider: new SampleOdspTokenProvider(getToken),
		driveId: fileStorageContainerId,
		filePath: "",
	},
};

// Create the Fluid client instance
const client = new OdspClient(clientProps);

const { container } = await client.createContainer(CONTAINER_SCHEMA);
const treeView = container.initialObjects.appState.viewWith(TREE_CONFIGURATION);
treeView.initialize(new SharedTreeAppState(INITIAL_APP_STATE));

// Add handles to SharedString
for (const task of treeView.root.taskGroups[0]?.tasks ?? []) {
	const sharedString = await container.create(SharedString);
	sharedString.insertText(0, "Enter notes here.");
	task.notes = sharedString.handle;
}

const containerId = await container.attach();
console.log("Container ID:", containerId);

// Now add attachment blobs, since it's unsupported before attach
for (const task of treeView.root.taskGroups[0]?.tasks ?? []) {
	task.image = await uploadBlob(pngBytes.buffer, container);
}

/**
 * Uploads a blob to the Fluid container and returns a handle to it
 *
 * @param blob - The binary data to upload
 * @param containerParam - The Fluid container
 * @returns A promise that resolves to a handle to the uploaded blob
 */
export async function uploadBlob(
	blob: ArrayBuffer | ArrayBufferLike,
	containerParam: IFluidContainer<typeof CONTAINER_SCHEMA>,
): Promise<IFluidHandle<ArrayBufferLike>> {
	// This is a hacky workaround to access the `uploadBlob` method on the runtime.
	// It should be removed once Fluid exposes a public API for blob upload in odsp-client.
	const runtime = (
		containerParam.initialObjects.appState as unknown as { runtime: IFluidDataStoreRuntime }
	).runtime;
	if (runtime === undefined) {
		// This will occur if SharedTree's implementation details change in a way that makes the above workaround invalid.
		throw new Error("Runtime not found on SharedTree instance");
	}
	return runtime.uploadBlob(blob);
}
