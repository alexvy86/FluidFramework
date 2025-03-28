/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { AuthenticationResult, ClientCredentialRequest } from "@azure/msal-node";
import { Client, type AuthenticationProviderOptions } from "@microsoft/microsoft-graph-client";
// import {
// 	AuthCodeMSALBrowserAuthenticationProvider,
// 	AuthCodeMSALBrowserAuthenticationProviderOptions,
// 	// eslint-disable-next-line import/no-internal-modules -- Not exported in the public API; docs use this pattern.
// } from "@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser";
import type { Site } from "@microsoft/microsoft-graph-types";

export interface FileStorageContainer {
	containerTypeId: string;
	createdDateTime: string;
	displayName: string;
	id: string;
}

// Helper class to interact with the Microsoft Graph API
// This allows us to interact with the Graph API to get the file storage container ID,
// the Fluid container ID, and the site URL. As well as create a sharing link and get the shared item.
export class GraphHelper {
	private readonly graphClient: Client;
	constructor(accessToken: string) {
		// Initialize the Graph client
		this.graphClient = Client.initWithMiddleware({
			authProvider: {
				getAccessToken: async (
					authenticationProviderOptions?: AuthenticationProviderOptions,
				) => accessToken,
			},
		});
	}

	// Function to get the file storage container ID
	public async getFileStorageContainerId(): Promise<string> {
		// Get the container type id from the environment variables
		const containerTypeId = process.env.SPE_CONTAINER_TYPE_ID;

		if (containerTypeId === undefined) {
			throw new Error("SPE_CONTAINER_TYPE_ID is not defined");
		}

		// Fetch the file storage container ID using the Graph API
		try {
			const response = (await this.graphClient
				.api("/storage/fileStorage/containers")
				.filter(`containerTypeId eq ${containerTypeId}`)
				.version("beta")
				.get()) as { value: FileStorageContainer[] }; // We know the response will contain an array of FileStorageContainer

			const fileStorageContainers: FileStorageContainer[] = response.value;

			if (fileStorageContainers[0] === undefined) {
				throw new Error("Graph client found no fileStorageContainers");
			}

			return fileStorageContainers[0].id;
		} catch (error) {
			console.error("Error while fetching file storage container ID:", error);
			throw error; // re-throw the error if you want it to propagate
		}
	}

	// Function to get the site URL
	public async getSiteUrl(): Promise<string> {
		const response = (await this.graphClient
			.api("/sites")
			.version("beta")
			.filter("siteCollection/root ne null")
			.select("siteCollection,webUrl")
			.get()) as { value: Site[] }; // We know the response will contain an array of FileStorageContainer

		const sites: Site[] = response.value;

		if (sites[0] === undefined) {
			throw new Error("Graph client found no sites");
		}

		return sites[0].webUrl as string;
	}

	// Function to create a sharing link which will be used to get the shared item
	public async createSharingLink(
		driveId: string,
		id: string,
		permType: string,
	): Promise<string> {
		const permission = {
			type: permType,
			scope: "organization",
		};
		const response = (await this.graphClient
			.api(`/drives/${driveId}/items/${id}/createLink`)
			.post(permission)) as { link: string; shareId: string }; // We know the shape of the response

		console.log("createSharingLink response:", response.link);

		return response.shareId;
	}

	// Function to get the shared item using the sharing link
	public async getSharedItem(shareId: string): Promise<{ itemId: string; driveId: string }> {
		const response = (await this.graphClient
			.api(`/shares/${shareId}/driveItem`)
			.header("Prefer", "redeemSharingLink")
			.get()) as { id: string; parentReference: { driveId: string } }; // We know the shape of the response

		return {
			itemId: response.id,
			driveId: response.parentReference.driveId,
		};
	}

	// Function to get the user's profile photo
	public async getProfilePhoto(): Promise<string> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const photoBlob = await this.graphClient.api("/me/photo/$value").get();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		return URL.createObjectURL(photoBlob);
	}
}
