/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { IFluidDataStoreRuntime } from "@fluidframework/datastore-definitions/internal";
import type { IFluidContainer, IFluidHandle } from "fluid-framework";

import type { CONTAINER_SCHEMA } from "@/types/sharedTreeAppSchema";

/**
 * Uploads a blob to the Fluid container and returns a handle to it
 *
 * @param blob - The binary data to upload
 * @param container - The Fluid container
 * @returns A promise that resolves to a handle to the uploaded blob
 */
export async function uploadBlob(
    blob: ArrayBuffer | ArrayBufferLike,
    container: IFluidContainer<typeof CONTAINER_SCHEMA>
): Promise<IFluidHandle<ArrayBufferLike>> {
    // This is a hacky workaround to access the `uploadBlob` method on the runtime.
    // It should be removed once Fluid exposes a public API for blob upload in odsp-client.
    const runtime = (container.initialObjects.appState as unknown as { runtime: IFluidDataStoreRuntime }).runtime;
    if (runtime === undefined) {
        // This will occur if SharedTree's implementation details change in a way that makes the above workaround invalid.
        throw new Error('Runtime not found on SharedTree instance');
    }
    return runtime.uploadBlob(blob);
}

/**
 * This is a higher-order function that creates a function to upload a blob without directly exposing the container
 *
 * @param container - The Fluid container to use for uploads
 * @returns A function that can be called with binary data to upload
 */
export function createBlobUploader(
    container: IFluidContainer<typeof CONTAINER_SCHEMA>
): (blob: ArrayBuffer | ArrayBufferLike) => Promise<IFluidHandle<ArrayBufferLike>> {
    return (blob: ArrayBuffer | ArrayBufferLike) => uploadBlob(blob, container);
}
