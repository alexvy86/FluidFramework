/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import process from "node:process";

import {
	Configuration,
	ConfidentialClientApplication,
	type ClientCredentialRequest,
	type AuthenticationResult,
	LogLevel,
} from "@azure/msal-node";

// eslint-disable-next-line import/no-unassigned-import, import/no-internal-modules
import "dotenv/config"; // process.env now has the values defined in a .env file

// import { OdspClient } from "@fluidframework/odsp-client/beta";

// import { GraphHelper } from "./graphHelper.js";
// import { SampleOdspTokenProvider } from "./tokenProvider.js";

const clientId = process.env.clientId;
if (clientId === undefined) {
	throw new Error("clientId env variable is not defined");
}

const tenantId = process.env.tenantId;
if (tenantId === undefined) {
	throw new Error("tenantId env variable is not defined");
}

const clientSecret = process.env.clientSecret;
if (clientSecret === undefined) {
	throw new Error("clientSecret env variable is not defined");
}

const clientConfig: Configuration = {
	auth: {
		clientId,
		authority: `https://login.microsoftonline.com/${tenantId}`,
		clientSecret,
	},
	system: {
		loggerOptions: {
			loggerCallback: (logLevel, message, containsPii) => {
				console.log(`[${logLevel}] ${message}`);
			},
			logLevel: LogLevel.Verbose,
		},
	},
};

/**
 * With client credentials flows permissions need to be granted in the portal by a tenant administrator.
 * The scope is always in the format '<resource-appId-uri>/.default'. For more, visit:
 * https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow
 */
export const defaultTokenRequest = {
	scopes: ["https://graph.microsoft.com/.default"],
};

const cca = new ConfidentialClientApplication(clientConfig);

/**
 * Acquires token with client credentials.
 */
export async function getToken(
	tokenRequest: ClientCredentialRequest = defaultTokenRequest,
	// eslint-disable-next-line @rushstack/no-new-null
): Promise<AuthenticationResult | null> {
	return cca.acquireTokenByClientCredential(tokenRequest);
}
