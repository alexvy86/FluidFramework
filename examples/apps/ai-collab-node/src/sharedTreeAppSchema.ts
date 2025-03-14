/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { TreeViewConfiguration } from "@fluidframework/tree";
import { SchemaFactoryAlpha } from "@fluidframework/tree/alpha";
import { SharedTree, type ContainerSchema } from "fluid-framework";
// eslint-disable-next-line import/no-internal-modules -- This is the correct place to get SharedString
import { SharedString } from "fluid-framework/legacy";

// The string passed to the SchemaFactory should be unique
const sf = new SchemaFactoryAlpha("node-spe-application");

export class SharedTreeTask extends sf.object(
	"Task",
	{
		title: sf.required(sf.string, {
			metadata: {
				description: `The title of the task.`,
			},
		}),
		id: sf.identifier,
		description: sf.required(sf.string, {
			metadata: {
				description: `The description of the task.`,
			},
		}),
		complexity: sf.required(sf.number, {
			metadata: {
				description: `The complexity of the task as a fibonacci number.`,
			},
		}),
		assignee: sf.required(sf.string, {
			metadata: {
				description: `The name of the tasks assignee e.g. "Bob" or "Alice".`,
			},
		}),
		notes: sf.optional(sf.handle, {
			metadata: {
				description: `Extra notes about the task`,
			},
		}),
		image: sf.optional(sf.handle, {
			metadata: {
				description: `Some image associate with the task`,
			},
		}),
	},
	{
		metadata: {
			description: `A task that can be assigned to an engineer.`,
		},
	},
) {}

export class SharedTreeTaskList extends sf.array("TaskList", SharedTreeTask) {}

export class SharedTreeEngineer extends sf.object(
	"Engineer",
	{
		name: sf.required(sf.string, {
			metadata: {
				description: `The name of the engineer.`,
			},
		}),
		id: sf.identifier,
		maxCapacity: sf.required(sf.number, {
			metadata: {
				description: `The maximum capacity of tasks this engineer can handle, measured in task complexity points.`,
			},
		}),
	},
	{
		metadata: {
			description: `An engineer to whom tasks may be assigned.`,
		},
	},
) {}

export class SharedTreeEngineerList extends sf.array("EngineerList", SharedTreeEngineer) {}

export class SharedTreeTaskGroup extends sf.object(
	"TaskGroup",
	{
		description: sf.required(sf.string, {
			metadata: {
				description: `The description of the task group.`,
			},
		}),
		id: sf.identifier,
		title: sf.required(sf.string, {
			metadata: {
				description: `The title of the task group.`,
			},
		}),
		tasks: sf.required(SharedTreeTaskList, {
			metadata: {
				description: `The lists of tasks within this task group.`,
			},
		}),
		engineers: sf.required(SharedTreeEngineerList, {
			metadata: {
				description: `The lists of engineers within this task group to whom tasks may be assigned.`,
			},
		}),
	},
	{
		metadata: {
			description: "A collection of tasks and engineers to whom tasks may be assigned.",
		},
	},
) {}

export class SharedTreeTaskGroupList extends sf.array("TaskGroupList", SharedTreeTaskGroup) {}

export class SharedTreeAppState extends sf.object("AppState", {
	taskGroups: sf.required(SharedTreeTaskGroupList, {
		metadata: {
			description: `The list of task groups that are being managed by this task management application.`,
		},
	}),
}) {}

export const INITIAL_APP_STATE = {
	taskGroups: [
		{
			title: "My First Task Group",
			description: "Placeholder for first task group",
			tasks: [
				{
					assignee: "Alice",
					title: "Task #1",
					description:
						"This is the first task. Blah Blah blah Blah Blah blahBlah Blah blahBlah Blah blahBlah Blah blah",
					complexity: 1,
				},
				{
					assignee: "Bob",
					title: "Task #2",
					description:
						"This is the second task.  Blah Blah blah Blah Blah blahBlah Blah blahBlah Blah blahBlah Blah blah",
					complexity: 2,
				},
				{
					assignee: "Charlie",
					title: "Task #3",
					description:
						"This is the third task!  Blah Blah blah Blah Blah blahBlah Blah blahBlah Blah blahBlah Blah blah",
					complexity: 3,
				},
			],
			engineers: [
				{
					name: "Alice",
					maxCapacity: 15,
				},
				{
					name: "Bob",
					maxCapacity: 12,
				},
				{
					name: "Charlie",
					maxCapacity: 7,
				},
			],
		},
	],
} as const;

export const CONTAINER_SCHEMA = {
	initialObjects: {
		appState: SharedTree,
	},
	dynamicObjectTypes: [SharedString],
} satisfies ContainerSchema;

export const TREE_CONFIGURATION = new TreeViewConfiguration({
	schema: SharedTreeAppState,
});
