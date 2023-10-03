/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as path from "path";
import { Response, Request } from "express";
import nconf from "nconf";

/**
 * Helper function to handle a promise that should be returned to the user
 */
export function handleResponse<T>(
	resultP: Promise<T>,
	response: Response,
	cache = true,
	status: number = 200,
	handler: (value: T) => void = (value) => value,
	request?: Request
) {
	const start = performance.now();
	resultP
	.then((value) => {
		console.log("HANDLERESPONSE_PERF:", performance.now() - start, "ms", "request:", request?.method, request?.url);
		return value;
	})
	.then(handler)
	.then(
		(result) => {
			if (cache) {
				response.setHeader("Cache-Control", "public, max-age=31536000");
			}

			response.status(status).json(result);
		},
		(error) => {
			console.log("UNEXPECTED ERROR HANDLING HTTP REQUEST:", error);
			response.status(400).json(error);
		},
	)
	.catch((reason) => {
		console.log("UNEXPECTED ERROR HANDLING HTTP REQUEST:", reason);
	});
}

export function getGitDir(store: nconf.Provider, tenantId: string) {
	const directory = store.get("storage");
	return path.join(directory, `./${tenantId}`);
}
