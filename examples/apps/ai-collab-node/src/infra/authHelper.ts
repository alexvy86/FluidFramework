/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import process from "node:process";

// import { PublicClientApplication, InteractionType, AccountInfo } from "@azure/msal-node";
import {
	Configuration,
	ConfidentialClientApplication,
	type ClientCredentialRequest,
} from "@azure/msal-node";
import "dotenv/config"; // process.env now has the values defined in a .env file

import { OdspClient } from "@fluidframework/odsp-client/beta";

import { GraphHelper } from "./graphHelper.js";
import { SampleOdspTokenProvider } from "./tokenProvider.js";

// Helper function to authenticate the user
export async function TokenResponse(): Promise<string | null> {
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
	};
	const cca = new ConfidentialClientApplication(clientConfig);

	// With client credentials flows permissions need to be granted in the portal by a tenant administrator.
	// The scope is always in the format "<resource>/.default"
	const clientCredentialRequest: ClientCredentialRequest = {
		scopes: ["FileStorageContainer.Selected", "Files.ReadWrite"],
		// azureRegion: null, // (optional) specify the region you will deploy your application to here (e.g. "westus2")
		skipCache: true, // (optional) this skips the cache and forces MSAL to get a new token from Azure AD
	};

	const authResult = await cca.acquireTokenByClientCredential(clientCredentialRequest);

	return authResult?.accessToken ?? null;
}

export let graphHelper: GraphHelper;

export async function start(): Promise<{
	client: OdspClient;
	containerId: string;
	getShareLink: (fluidContainerId: string) => Promise<string>;
}> {
	const tokenResponse = await authHelper();

	if (tokenResponse === null) {
		const currentAccounts = msalInstance.getAllAccounts();
		if (currentAccounts.length === 0) {
			// no accounts signed-in, attempt to sign a user in
			await msalInstance.loginRedirect({
				scopes: ["FileStorageContainer.Selected", "Files.ReadWrite"],
			});

			throw new Error(
				"This should never happen! The previous line should have caused a browser redirect.",
			);
		} else {
			// The user is signed in.
			// Treat more than one account signed in and a single account the same as this is just a sample.
			// A real app would need to handle the multiple accounts case.
			// For now, just use the first account.
			const account = msalInstance.getAllAccounts()[0];
			if (account === undefined) {
				throw new Error("No account found after logging in");
			}
			return signedInStart(msalInstance, account);
		}
	} else {
		return signedInStart(msalInstance, tokenResponse.account);
	}
}

async function signedInStart(
	msalInstance: PublicClientApplication,
	account: AccountInfo,
): Promise<{
	client: OdspClient;
	containerId: string;
	getShareLink: (fluidContainerId: string) => Promise<string>;
}> {
	// Set the active account
	msalInstance.setActiveAccount(account);
	console.log(`Set active account: ${account.tenantId} - ${account.username}`);

	// Create the GraphHelper instance
	// This is used to interact with the Graph API
	// Which allows the app to get the file storage container id, the Fluid container id,
	// and the site URL.
	graphHelper = new GraphHelper(msalInstance, account);

	// Define a function to get the container info based on the URL hash
	// The URL hash is the shared item id and will be used to get the file storage container id
	// and the Fluid container id. If there is no hash, then the app will create a new Fluid container
	// in a later step.
	const getContainerInfo = async (): Promise<
		{ driveId: string; itemId: string } | undefined
	> => {
		const shareId = location.hash.slice(1);
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
	let containerId = "";

	// If containerInfo is undefined, then get the file storage container id using the function
	// defined above.
	// If the containerInfo is not undefined, then use the file storage container id and Fluid container id
	// from containerInfo.
	if (containerInfo === undefined) {
		fileStorageContainerId = await getFileStorageContainerId();
	} else {
		fileStorageContainerId = containerInfo.driveId;
		containerId = containerInfo.itemId;
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
			tokenProvider: new SampleOdspTokenProvider(msalInstance),
			driveId: fileStorageContainerId,
			filePath: "",
		},
	};

	// Create the Fluid client instance
	const client = new OdspClient(clientProps);

	async function getShareLink(fluidContainerId: string): Promise<string> {
		return graphHelper.createSharingLink(
			clientProps.connection.driveId,
			fluidContainerId,
			"edit",
		);
	}

	return { client, containerId, getShareLink };
}
