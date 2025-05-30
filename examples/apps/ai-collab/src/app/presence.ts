/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	Presence,
	StateFactory,
	type Attendee,
	type StatesWorkspace,
	type StatesWorkspaceSchema,
} from "@fluidframework/presence/beta";

import { getProfilePhoto } from "@/infra/authHelper";

export interface User {
	photo: string;
}

const statesSchema = {
	onlineUsers: StateFactory.latest({ local: { photo: "" } satisfies User }),
} satisfies StatesWorkspaceSchema;

export type UserPresence = StatesWorkspace<typeof statesSchema>;

// Takes a presence object and returns the user presence object that contains the shared object states
export function buildUserPresence(presence: Presence): UserPresence {
	const states = presence.states.getWorkspace(`name:user-avatar-states`, statesSchema);
	return states;
}

export class PresenceManager {
	// A PresenceState object to manage the presence of users within the app
	private readonly usersState: UserPresence;
	// A map of SessionClient to UserInfo, where users can share their info with other users
	private readonly userInfoMap: Map<Attendee, User> = new Map();
	// A callback method to get updates when remote UserInfo changes
	private userInfoCallback: (userInfoMap: Map<Attendee, User>) => void = () => {};

	constructor(private readonly presence: Presence) {
		// Address for the presence state, this is used to organize the presence states and avoid conflicts
		const appSelectionWorkspaceAddress = "aiCollab:workspace";

		// Initialize presence state for the app selection workspace
		this.usersState = presence.states.getWorkspace(
			appSelectionWorkspaceAddress, // Workspace address
			statesSchema, // Workspace schema
		);

		// Listen for updates to the userInfo property in the presence state
		this.usersState.states.onlineUsers.events.on("remoteUpdated", (update) => {
			// The remote client that updated the userInfo property
			const remoteSessionClient = update.attendee;
			// The new value of the userInfo property
			const remoteUserInfo = update.value;

			// Update the userInfoMap with the new value
			this.userInfoMap.set(remoteSessionClient, remoteUserInfo);
			// Notify the app about the updated userInfoMap
			this.userInfoCallback(this.userInfoMap);
		});

		// Set the local user's info
		this.setMyUserInfo().catch((error) => {
			console.error(`Error: ${error} when setting local user info`);
		});
	}

	// Set the local user's info and set it on the Presence State to share with other clients
	private async setMyUserInfo(): Promise<void> {
		const clientId = process.env.NEXT_PUBLIC_SPE_CLIENT_ID;
		const tenantId = process.env.NEXT_PUBLIC_SPE_ENTRA_TENANT_ID;

		// spe client
		if (tenantId !== undefined && clientId !== undefined) {
			const photoUrl = await getProfilePhoto();
			this.usersState.states.onlineUsers.local = { photo: photoUrl };
		}

		this.userInfoMap.set(
			this.presence.attendees.getMyself(),
			this.usersState.states.onlineUsers.local,
		);
		this.userInfoCallback(this.userInfoMap);
	}

	// Returns the presence object
	getPresence(): Presence {
		return this.presence;
	}

	// Allows the app to listen for updates to the userInfoMap
	setUserInfoUpdateListener(callback: (userInfoMap: Map<Attendee, User>) => void): void {
		this.userInfoCallback = callback;
	}

	// Returns the UserInfo of given session clients
	getUserInfo(sessionList: Attendee[]): User[] {
		const userInfoList: User[] = [];

		for (const sessionClient of sessionList) {
			// If local user or remote user is connected, then only add it to the list
			try {
				const userInfo = this.usersState.states.onlineUsers.getRemote(sessionClient).value;
				// If the user is local user, then add it to the beginning of the list
				if (sessionClient.attendeeId === this.presence.attendees.getMyself().attendeeId) {
					userInfoList.push(userInfo);
				} else {
					// If the user is remote user, then add it to the end of the list
					userInfoList.unshift(userInfo);
				}
			} catch (error) {
				console.error(
					`Error: ${error} when getting user info for session client: ${sessionClient.attendeeId}`,
				);
			}
		}

		return userInfoList;
	}
}
