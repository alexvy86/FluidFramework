/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

// import {
// 	AuthenticationResult,
// 	InteractionRequiredAuthError,
// 	PublicClientApplication,
// } from "@azure/msal-browser";
import type { AuthenticationResult, ClientCredentialRequest } from "@azure/msal-node";
import { IOdspTokenProvider, type TokenResponse } from "@fluidframework/odsp-client/beta";

// import { defaultTokenRequest } from "./authHelper.js";

// Sample implementation of the IOdspTokenProvider interface.
// Provides the token that the Fluid service expects when asked for the Fluid container and for the WebSocket connection.
export class SampleOdspTokenProvider implements IOdspTokenProvider {
	constructor(
		private readonly getToken: (
			tokenRequest: ClientCredentialRequest,
		) => Promise<AuthenticationResult | null>,
	) {}

	// Fetch the token for the orderer service
	public async fetchWebsocketToken(): Promise<TokenResponse> {
		const pushScope = ["offline_access https://pushchannel.1drv.ms/PushChannel.ReadWrite.All"];
		const token = await this.fetchTokens(pushScope);
		return {
			fromCache: true,
			token,
		};
	}

	// Fetch the token for the storage service
	public async fetchStorageToken(siteUrl: string): Promise<TokenResponse> {
		// Note: for user-based authentication, the scope is normally 'Container.Selected', but for application-based
		// authentication, it needs to be '.default'.
		// const storageScope = [`${siteUrl}/Container.Selected`];
		const storageScope = [`${siteUrl}/.default`];

		const token = await this.fetchTokens(storageScope);

		return {
			fromCache: true,
			token,
		};
	}

	private async fetchTokens(scope: string[]): Promise<string> {
		const response = await this.getToken({
			scopes: scope,
		});
		if (response === null) {
			throw new Error("Failed to get token");
		}
		return response.accessToken;
	}
}
