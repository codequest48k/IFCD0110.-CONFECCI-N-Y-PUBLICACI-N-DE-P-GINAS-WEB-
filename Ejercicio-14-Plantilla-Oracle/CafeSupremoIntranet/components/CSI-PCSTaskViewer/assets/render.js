/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/*
 * PCS Task Viewer Custom Component
 *
 * Description:
 * This custom component uses PCS REST APIs to get tasks and related data from PCS, and shows PCS tasks assigned to the
 * user who is authenticated automatically using auth token, or basic authentication using user id/password, if the auth
 * token is not available. If basic authentication is required, then it shows login form, and sends the credentials with
 * the REST request. If the first REST request succeeds without authentication error, then it removes the login form, and
 * shows the task list. Each task shows task name, priority indicator (for priority 2 or 1) and due date if available.
 * If the user selects a task, then it gets the actions (displayed as buttons) and the associated task form. The task form
 * is a Sites page using the same name as the task, except spaces in name are replaced by dash characters and ends with
 * ".html". If the Sites page is not available, then it checks if the public link for Documents folder is available from
 * the Custom Settings. If yes, then it gets task payload, and parses Document GUID from task payload. If the Document
 * GUID is available, then it generated the Document URL using the public link available from Custom Settings, and then
 * shows the Document as task form. If no, then it shows error in webbar. If Sites page and public link are not available,
 * then it shows error in web bar. If the user clicks on an action button, then it calls PCS REST API to complete
 * that task, and refreshes the task, and adds any new tasks based on the last task completed. After the user completes
 * all tasks, it pings every second to get any tasks, and stops pinging when at least one task is available.
 *
 * Some work arounds and limitations:
 *
 * The task form area is hosted in an iframe, and its size cannot be detected correctly using "onload" event of iframe,
 * becasuse Sites pages render the components in slots after the iframe is loaded. So a work around is done to ping
 * every second for the size of the content, and if that is diffrent than the previous attempt, then resize the iframe.
 *
 * That works for Sites pages. But does not work for Document content dues to criss-domain security error. So, another
 * work around is done to use Document Height value from the Custom Settings dialog to set the height of the Document
 * hosted in the iframe.
 *
 * For the Sites pages, if the content within the Sites page reduces in size, then subsequent request to get the
 * size of the content returns the last iframe size as the smaller content still fits in the larger iframe. So a limitaion
 * is that iframe does not shrink in size if the content within iframe reduces. Similarly, if the browser window is
 * resized manually then the iframe width reduces, but the height remains same.
 *
 */

/* globals define */
/* global SCSRenderAPI, SCS */
define([
	'knockout',
	'jquery',
	'text!./templates/component.html',
	'./js/pcsauth'
], function (ko, $, componentTemplate, PCSAuth) {
	'use strict';
		
	// ----------------------------------------------
	// Define a Knockout ViewModel for your template
	// ----------------------------------------------
	var ComponentViewModel = function (args) {
		var self = this,
			SitesSDK = args.SitesSDK;
		// store the args
		self.mode = args.viewMode;
		self.id = args.id;

		// handle initialization
		self.customSettingsDataInitialized = ko.observable(false);
		self.initialized = ko.computed(function () {
			return self.customSettingsDataInitialized();
		}, self);
		//
		// Handle property changes
		//
		self.updateCustomSettingsData = function (customData) {
			self.retrieveTasksURL = customData.hasOwnProperty('retrieveTasksURL') ? customData.retrieveTasksURL : "https://<PCS Server>";
			self.taskAssignment = customData.hasOwnProperty('taskAssignment') ? customData.taskAssignment : "MY_AND_GROUP";
			self.pcsProcessName = customData.hasOwnProperty('pcsProcessName') ? customData.pcsProcessName : "";
			self.docsFolderPublicLink = customData.hasOwnProperty('docsFolderPublicLink') ? customData.docsFolderPublicLink : "";
			self.docHeight = customData.hasOwnProperty('docHeight') ? customData.docHeight : "600"; //Default 600 px height
			console.log("URL = " + self.retrieveTasksURL + ", Task Assignment = " + self.taskAssignment + ", Process Name = " + self.pcsProcessName + ", Public link =" + self.docsFolderPublicLink + ", Document Height =" + self.docHeight);
			self.customSettingsDataInitialized(true);
		};
		//
		// Get the current customSettingsData values
		//
		SitesSDK.getProperty('customSettingsData', self.updateCustomSettingsData);
		//
		//  Listen for changes to the settings data.
		//      e.g.: When the Settings Panel changes the data
		//
		self.updateSettings = function (settings) {
			if (settings.property === 'customSettingsData') {
				self.updateCustomSettingsData(settings.value);
				console.log("Settings updated. Reloading component.");
				self.myImpl.container.empty();
				self.myImpl.container.append("<link type=\"text/css\" rel=\"stylesheet\" href=\"" + self.myImpl.assetsURL + "/css/pcs-task-viewer.css\">");
				self.myImpl.container.append(componentTemplate);
				self.myImpl.initializeData();
				self.myImpl.initPcsTaskViewer();
				//self.myImpl.setupTaskList();
			}
		};
		SitesSDK.subscribe('SETTINGS_UPDATED', self.updateSettings);
	};
	// ----------------------------------------------
	// Create a knockout based component implemention
	// ----------------------------------------------
	var ComponentImpl = function (args) {
		// Initialze the custom component
		this.init(args);
	};
	// initialize all the values within the component from the given argument values
	ComponentImpl.prototype.init = function (args) {
		this.initializeData();
		var me = this;
		args.SitesSDK.getProperty('assetsURL', function (value) {
			me.assetsURL = value;
			console.log("Assets URL =" + value);
		});
		this.selectedTaskName = "";
		this.selectedProcessName = "";
		this.createViewModel(args);
		this.createTemplate(args);
		this.setupCallbacks();
	};
	ComponentImpl.prototype.initializeData = function () {
		this.authType = "OAuth";
		this.currentTaskList = new Array();
		this.taskHashMap = {};
		this.autoLoadCounter = 0;
		this.MAX_AUTOLOAD = 10; //Maximum number of times auto loading of tasks will be attempted if no tasks are available
		this.isAutoRunMode = false;
		clearInterval(this.autoLoadTask);
		this.autoLoadTask = undefined;
		this.pingIframeSize = undefined;
		this.lastIframeSize = 0;
	};
	// create the viewModel from the initial values
	ComponentImpl.prototype.createViewModel = function (args) {
		// create the viewModel
		this.viewModel = new ComponentViewModel(args);
		this.viewModel.myImpl = this;
	};
	// create the template based on the initial values
	ComponentImpl.prototype.createTemplate = function (args) {
		// create a unique ID for the div to add, this will be passed to the callback
		this.contentId = args.id + '_content_' + args.mode;
		// create a hidden custom component template that can be added to the DOM
		this.template = '<div id="' + this.contentId + '"/>';
	};
	//
	// SDK Callbacks
	// setup the callbacks expected by the SDK API
	//
	ComponentImpl.prototype.setupCallbacks = function () {
		//
		// callback - render: add the component into the page
		//
		this.render = $.proxy(function (container) {
			this.container = $(container);
			// add the custom component template to the DOM
			this.container.append("<link type=\"text/css\" rel=\"stylesheet\" href=\"" + this.assetsURL + "/css/pcs-task-viewer.css\">");
			this.container.append(componentTemplate);
			console.log("Render PCS task viewer.");
			this.initPcsTaskViewer();
			//this.setupTaskList();
		}, this);
		//
		// callback - update: handle property change event
		//
		this.update = $.proxy(function (args) {
			var self = this;
			// deal with each property changed
			$.each(args.properties, function (index, property) {
				if (property) {
					if (property.name === 'customSettingsData') {
						self.viewModel.updateComponentData(property.value);
					} else if (property.name === 'componentLayout') {
						self.viewModel.updateLayout(property.value);
					}
				}
			});
		}, this);
		//
		// callback - dispose: cleanup after component when it is removed from the page
		//
		this.dispose = $.proxy(function () {
			// nothing required for this component since knockout disposal will automatically clean up the node
		}, this);
	};
	//
	// Automatically complete all tasks. It is triggered by a link outside this app.
	//
	ComponentImpl.prototype.autoRunProcess = function (event, param) {
		//Check if the user has been authenticated. If not, then there is no point in running this auto run.
		//This function gets triigered from a link outside the app. So it is necesary to check this, otherwise,
		//the Completed Tasks heading shows up when the Settings dialog is launched at the design time, as
		//that also posts a message to the iframe for this app.
		if (event.data === "Autorun_PCS_Task_Viewer" && this.currentTaskList.length > 0) {
			console.log("Called autoRunProcess. event.data = " + event.data);
			param.container.find("#taskContent").hide();
			param.showAutoRunContent();
			//Take a snapshot of currently displayed tasks
			var tasks = param.container.find("#tasklist").find("li");
			console.log("Current number of tasks = " + tasks.length);
			//Change mode to auto run, so that when new tasks are received, they will be run automatically
			param.isAutoRunMode = true;
			//Run the tasks from snapshots. If anymore tasks are received, then they will be auto run
			//by the showTasks function while in autorun mode
			$.each(tasks, function (key, value) {
				param.showWebBarMessage("Automatically completing task " + param.taskHashMap[value.getAttribute("id")] + ".", param.assetsURL + "/images/animated_spinner_clock_positive.gif");
				//Get Task actions
				var url = param.pcsURL + "tasks/" + value.getAttribute("id");
				param.callPcs("GetTaskActions", url, "Get", param.container.find("#taskFormActions"), null, null);
			});
		}
	};
	ComponentImpl.prototype.callPcs = function (operation, url, requestType, ui, data, formUrl, taskId) {
		if (formUrl !== undefined) {
			console.log("Embedding Sites Page: " + formUrl);
		}

		var urlQuery = encodeURI(url);
		var authHeader;
		if (this.authType === "OAuth") {
			authHeader = "Bearer " + this.OAuthToken;
		} else {
			authHeader = "Basic " + btoa(this.demoUserId + ":" + this.demoPassword);
		}

		var me = this;
		$.ajax({
			type: requestType,
			url: urlQuery,
			contentType: 'application/json',
			data: JSON.stringify(data),
			async: true,
			headers: {
				"Authorization": authHeader
			},
			crossDomain: true
		}).done(function (data, textStatus, jqXHR) {
			if (operation === "GetTasks") {
				me.showTasks(data, textStatus, jqXHR);
			} else if (operation === "GetTaskForm") {
				me.showTaskForm(data, textStatus, jqXHR, ui, false);
			} else if (operation === "GetTaskActions") {
				me.showTaskActionAndForm(data, url, ui, formUrl, taskId);
			} else if (operation === "TaskAction") {
				me.refreshTaskList(true, false);
				//Remove completed task. We could just refresh the task list, but then we have to remove
				//existing tasks, and reload. That causes flashing of the screen as the list becomes empty
				//and the form shifts to left until tasks are loaded. So remove the completed task only.
				me.removeTask(url);
				if (me.isAutoRunMode) {
					//Show completed status
                    var resultRowHtml = me.createAutoRunResultTmpl({
						taskName: me.taskHashMap[url.substring(url.lastIndexOf("/") + 1)]
					});
					me.container.find("#autorunResults").append(resultRowHtml);
				}
				me.removeWebBarMessage();
			} else if (operation === "TaskDocument") {
				var $xml = $(data);
				var $id = $xml.find("id"); //find is case-sensitive. If not found, then return value is []
				var docGUID = $id.text(); //If element not found, then text value is blank
				console.log("Document GUID = " + docGUID);
				if (docGUID.trim() === "") {
					me.showWebBarMessage("Document ID not found in task payload.", me.assetsURL + "/images/error.png");
					console.log("Document GUID not available in task payload.");
				} else {
					console.log("Public link for upload folder = " + me.viewModel.docsFolderPublicLink);
					var folderPublicLink = me.viewModel.docsFolderPublicLink.replace("/documents/", "/documents/embed/");
					var docUrl = folderPublicLink.substring(0, folderPublicLink.indexOf("/folder/"));
					docUrl = docUrl + "/fileview/" + docGUID + "?hide=header+breadcrumbs+thumbs";
					console.log("Document URL = " + docUrl);
					me.showTaskForm(docUrl, null, null, me.container.find("#taskForm"), true);
				}
			}
		}).fail(function (jqXHR, textStatus, errorThrown) {
			//Handle any known HTTP errors, as any other error and exception not known at this time.
			if (jqXHR.status === 401) {
				//Unauthorized error
				me.container.find("#taskContent").hide();
				me.removeWebBarMessage();
				me.showLogin();
				if (this.authType === "OAuth") {
					me.removeWebBarMessage();
					console.log("Unable to authorize using OAuth token.");
					//Switch to basic authentication
					this.authType = "Basic";
				} else {
					me.container.find("#loginError").html("Invalid login.");
				}
			} else {
				//Show generic error
				if (operation === "GetTasks") {
					me.showWebBarMessage("Unable to get tasks.", me.assetsURL + "/images/error.png");
				} else if (operation === "GetTaskForm") {
					me.showWebBarMessage("Unable to get task form.", me.assetsURL + "/images/error.png");
				} else if (operation === "GetTaskActions") {
					me.showWebBarMessage("Unable to get task actions.", me.assetsURL + "/images/error.png");
				} else if (operation === "TaskAction") {
					me.showWebBarMessage("Unable to complete task action.", me.assetsURL + "/images/error.png");
				}
			}
		});
	};
	ComponentImpl.prototype.showTasks = function (data, textStatus, jqXHR) {
		if (!this.isAutoRunMode) {
			this.container.find("#taskContent").show();
			this.container.find("#taskListTitle").html("Tasks");
		}
		var me = this;
		if (data.items === undefined || data.items.length === 0) {
			me.container.find("#emptyTaskMsg").show();
		} else {
			me.container.find("#emptyTaskMsg").hide();
			var SelectedTaskID = 0;
			$.each(data.items, function (key, value) {
				var taskID = value.href.substring(value.href.lastIndexOf("/") + 1);
				if (me.currentTaskList.indexOf(taskID) === -1) {
					//The task does not exist already.
					//Add to current task list
					me.currentTaskList.push(taskID);
					me.taskHashMap[taskID] = value.title;
					if (me.isAutoRunMode) {
						//Automatically get the task actions.
						me.showWebBarMessage("Automatically completing task " + value.title + ".", me.assetsURL + "/images/animated_spinner_clock_positive.gif");
						//Get Task actions
						var url = me.pcsURL + "tasks/" + taskID;
						me.callPcs("GetTaskActions", url, "Get", me.container.find("#taskFormActions"), null, null);
					} else {
						var taskHtml = me.createTaskTmpl({
							taskID: taskID,
							title: value.title,
							priority: value.priority,
							seperator: ">",
							dueDate: (value.dueDate) ? me.formatDate(value.dueDate) : value.dueDate,
							processName: value.processName,
							defaultArrowIcon: me.assetsURL + "/images/Action_Button_24_ena.png",
							priorityIcon: me.assetsURL + "/images/priority.png"
						});
						if (value.priority <= 2) {
							//Show all high priority tasks first
							me.container.find("#tasklist").prepend(taskHtml);
						} else {
							me.container.find("#tasklist").append(taskHtml);
						}
					}
				}
				var currentListElement = $("#tasklist #" + taskID);
				// For Keyboard Accessibility
				currentListElement.attr('tabindex', 0);
				currentListElement.keyup(function (event) {
					if (event.keyCode === 13) {
						currentListElement.click();
					}
				});
				currentListElement.click(function () {
					if (SelectedTaskID === taskID) {
						//Add image code
						clearInterval(this.pingIframeSize);
						//Any task form other than default image is being shown. So clear it.
						$("#taskForm").empty();
						$("#taskForm").removeAttr("style");
						$("#taskForm").append("<img id=\"defaultImage\" alt=\"Welcome Onboard\" src=\"" + me.assetsURL + "/images/WelcomeOnboard.png\" style=\"width: calc(100%); max-width: 670px;\">");
						$("#taskFormActions").empty();
						$("#taskFormSeparator").remove();
						$("#" + taskID).css("background-color", "#FFF");
						//event.preventDefault();
						$("#" + taskID).find(".arrowIcon").attr("src", me.assetsURL + "/images/Action_Button_24_ena.png");
						SelectedTaskID = 0;
					} else {
						var Tasks = $("#tasklist").children();
						//Removing css properties of unselected task
						for (var i = 0; i < Tasks.length; i++) {
							if ($(Tasks[i]).attr('id') !== taskID) {
								$(Tasks[i]).css("background-color", "#FFF");
								//event.preventDefault();
								$(Tasks[i]).find(".arrowIcon").attr("src", me.assetsURL + "/images/Action_Button_24_ena.png");
							}
						}
						currentListElement.css("background-color", "#EBECED");
						clearInterval(me.pingIframeSize);
						me.pingIframeSize = undefined;
						me.selectedProcessName = value.processName;
						me.selectedTaskName = value.title;
						console.log("Task '" + me.selectedTaskName + "' selected for process '" + me.selectedProcessName + "'.");
						$(currentListElement).find(".arrowIcon").attr("src", me.assetsURL + "/images/Action_Button_24_ovr.png");
						me.container.find("#taskFormActions").empty();
						me.container.find("#taskFormSeparator").remove();
						me.container.find("#taskForm").empty();
						me.showWebBarMessage("Loading the task form and actions.", me.assetsURL + "/images/animated_spinner_clock_positive.gif");

						// URL to get the Task actions
						var url = me.pcsURL + "tasks/" + taskID;

						// URL to show the Sites Page associated to the Task
						var formUrl = SCSRenderAPI.sitePrefix;
						// If we can't get the sitePrefix then we can assume we're in Edit/Live mode and have to create the site prefix  a differnet way
						if (formUrl === undefined) {
							formUrl = "/sites/preview/" + SCSRenderAPI.getSiteId() + "/";
						}

						// Use the process name for the Sites root folder where these Sites Pages exist
						formUrl = formUrl + value.processName.toLowerCase() + "/";
						// Use the task name for the Sites Page to load
						formUrl = formUrl + value.title.toLowerCase().replace(/ /g, "-") + ".html";

						me.callPcs("GetTaskActions", url, "Get", me.container.find("#taskFormActions"), null, formUrl, taskID);
						SelectedTaskID = taskID;
					}
				});
			});
		}


		this.pcsURL = data.links[0].href;
		if (!this.isAutoRunMode) {
			if (this.container.find("#taskForm").find("#defaultImage").length === 0) {
				clearInterval(this.pingIframeSize);
				//Any task form other than default image is being shown. So clear it.
				this.container.find("#taskForm").empty();
				this.container.find("#taskFormActions").empty();
				this.container.find("#taskForm").removeAttr("style");
				this.container.find("#taskForm").append("<img id=\"defaultImage\" alt=\"Welcome Onboard\" src=\"" + me.assetsURL + "/images/WelcomeOnboard.png\" style=\"width: calc(100%); max-width: 670px;\">");
				this.container.find("#taskFormSeparator").remove();
			}
		}
		if (data.items !== undefined) {
			if (data.items.length > 0 || this.autoLoadCounter >= this.MAX_AUTOLOAD) {
				//Stop auto loading tasks
				if ((this.autoLoadTask !== undefined && this.isAutoRunMode) || (data.items.length > 0 && !this.isAutoRunMode)) {
					clearInterval(this.autoLoadTask);
					this.autoLoadTask = undefined;
				}
				//In addition, if max retries are done, then interpret this as end of process, because
				//there is no other way to know that process has ended
				if (this.autoLoadCounter >= this.MAX_AUTOLOAD && this.isAutoRunMode) {
					//Reload page to return to task list page
					this.isAutoRunMode = false;
					//location.reload();
					this.removeAutoRunContent();
					this.getTasks();
				}
				this.autoLoadCounter = 0;
			} else {
				//Kick off auto loading tasks every second as sometimes it takes a while for the next tasks to
				//appear in PCS.
				if (this.autoLoadTask === undefined) {
					this.autoLoadTask = setInterval(function () {
						me.refreshTaskList(this.isAutoRunMode, true);
					}, 1000);
				}
			}

			this.removeWebBarMessage();
		} else {
			me.showWebBarMessage("Unable to locate the PCS Process. Verify that you are pointed to a valid PCS Process in the PCSTaskViewer Component custom settings.");
		}
	};
	ComponentImpl.prototype.updateIframeSize = function (ui, showDocument) {
		var iframe = ui.find('.iframe-full-height');
		var height = 0;
		try {
			if (showDocument) {
				console.log("Setting document height to " + height);
				iframe.attr("height", this.viewModel.docHeight);
				ui.css("height", this.viewModel.docHeight);
			} else {
				height = iframe.contents().height();
				if (height === undefined) {
					// The contents of this iframe no longer exist so stop looking for its size (this can happen when switching between Sites Edit/Live modes)
					clearInterval(this.pingIframeSize);
				} else {
					if (height === null) {
						//iframe not added for the task for which no Sites page is available.
						height = 0;
					}
					if (height !== this.lastIframeSize) {
						// The iframe contents no longer exists (this is possible when switching between Edit/Live modes)
						this.lastIframeSize = height + 50; //Plus 50 for offset required on FF
						console.log("Resizing task form iframe size to " + this.lastIframeSize + "px.");
						iframe.attr("height", this.lastIframeSize + 'px');
						ui.css("height", this.lastIframeSize + 'px');
					}
				}
			}
		} catch (err) {
			// Window height not yet available... just ignore error
			//console.log("Unable to get iframe content. Error = " + err);
			//console.log("Retry upon next ping.");
		}
	};
	ComponentImpl.prototype.showTaskForm = function (url, textStatus, jqXHR, ui, showDocument) {
		//var cookies = jqXHR.getResponseHeader('Set-Cookie');
		//data = data+"&_wfContextId="+cookie;
		//var iframe = "<iframe src=\""+data+"\"/>";
		var iframe = "<iframe title=\"Task Details\" class=\"iframe-full-height\" frameborder=\"0\" src=\"" + url + "\"></iframe>";
		ui.removeAttr("style");
		ui.append(iframe);
		var iframeElement = ui.find('.iframe-full-height');
		iframeElement.attr("height", 0);
		var me = this;
		if (this.pingIframeSize === undefined) {
			this.pingIframeSize = setInterval(function () {
				me.updateIframeSize(ui, showDocument);
			}, 1000);
		}
		ui.find('.iframe-full-height').on('load', function () {
			me.removeWebBarMessage();
		});
	};
	ComponentImpl.prototype.showTaskActionAndForm = function (data, url, ui, formUrl, taskId) {
		var customActionCount = 0;
		this.container.find("#taskFormActions").empty();
		this.container.find("#taskFormSeparator").remove();
		this.container.find("#taskForm").empty();
		//		this.removeWebBarMessage();
		var me = this;
		$.each(data.actionList, function (key, value) {
			if (value.actionType === "Custom") {
				customActionCount++;
				if (formUrl === null) {
					//This is auto-run mode. Auto-complete first action for the task
					var data = { action: { id: value.title } };
					me.callPcs("TaskAction", url, "PUT", null, data);
					//Now break out of for loop as only first action needs to be completed in auto run mode
					return false; //This is equivalent to break statement.
				} else {
					//Add action buttons with right margin to maintain 10px space between buttons
					var form = "<input type=\"button\" class=\"scs-button-button\" style=\"margin-right: 10px;cursor: pointer;outline-offset: 4px;\" value=\"" + value.title + "\"/>";
					ui.append(form);
					ui.find("input[type=\"button\"][value=\"" + value.title + "\"]").click(function (event) {
						me.container.find("#taskFormActions").empty();
						me.container.find("#taskFormSeparator").remove();
						me.container.find("#taskForm").empty();
						me.showWebBarMessage("Processing your action for the selected task.", me.assetsURL + "/images/animated_spinner_clock_positive.gif");
						var data = { action: { id: value.title } };
						me.callPcs("TaskAction", url, "PUT", null, data);
					});
				}
			}
		});
		if (data.actionList.length > 0) {
			$("<hr id=\"taskFormSeparator\"/>").insertAfter(me.container.find("#taskFormActions"));
		}

		if (formUrl !== null) {
			if (me.pageExists()) {
				//Show Sites page as task form
				//User has not provided public link for upload folder. So show Sites page as task form.
				if (customActionCount > 0) {
					//Get task form from PCS
					//url = $("#"+ui.selected.getAttribute("id")).parent().parent().attr("id")+"tasks/"+ui.selected.getAttribute("id")+"/form?readOnly=true";
					//callPcs("GetTaskForm",url, "Get", $("#taskForm"));
					//For the demo, do not get task form from PCS, as cookies required for task form request are not yet available.
					//So, for now, comment out above two lines, and load static html page;
					me.showTaskForm(formUrl, null, null, me.container.find("#taskForm"), false);
				} else {
					me.showWebBarMessage("This task is already completed.", me.assetsURL + "/images/checkmark.png");
				}
			} else {
				console.log("Sites page not available for task '" + me.selectedTaskName + "'.");
				me.showWebBarMessage("Loading the task document.", me.assetsURL + "/images/animated_spinner_clock_positive.gif");
				if (me.viewModel.docsFolderPublicLink.trim() !== "") {
					//Call PCS and get the document ID
					console.log("Send request to get task payload.");
					var docUrl = me.pcsURL + "tasks/" + taskId + "/payload";
					me.callPcs("TaskDocument", docUrl, "Get", null, null);
				} else {
					console.log("Sites page not available for selected task and public link for upload folder not provided on Custom Settings dialog.");
					me.showWebBarMessage("Sites page for selected task and public link for upload folder not available.", me.assetsURL + "/images/error.png");
				}
			}
		}
	};
	ComponentImpl.prototype.pageExists = function () {
		var pageFound = false;
		var children = SCS.structureMap[SCS.navigationRoot].children;
		for (var i = 0; (i < children.length) && !pageFound; i++) {
			var node = SCS.structureMap[children[i]];
			if (node.name === this.selectedProcessName) {
				if (node.children.length > 0) {
					//Search child pages of this node
					for (var index = 0; index < node.children.length; index++) {
						var childNode = SCS.structureMap[node.children[index]];
						if (childNode.name === this.selectedTaskName) {
							console.log("Sites page available for task '" + this.selectedTaskName + "'.");
							pageFound = true;
							break;
						}
					}
				}
			}
		}
		return pageFound;
	};
	ComponentImpl.prototype.refreshTaskList = function (showWebbar, isAutoLoad) {
		if (this.autoLoadTask !== undefined && isAutoLoad === true && this.autoLoadCounter < this.MAX_AUTOLOAD) {
			//Increment counter to track how many times auto load has been attempted
			this.autoLoadCounter++;
		}
		if (showWebbar) {
			this.showWebBarMessage("Loading your tasks.", this.assetsURL + "/images/animated_spinner_clock_positive.gif");
		}

		//Get all tasks, without providing process name, in order to get tasks for subprocess as well
		this.callPcs("GetTasks", this.viewModel.retrieveTasksURL, "Get");
	};
	ComponentImpl.prototype.removeTask = function (url) {
		//Get the task ID from the URL.
		var taskID = url.substring(url.lastIndexOf("/") + 1);
		//Find the task using task ID, and remove it.
		this.container.find("li[id=" + taskID + "]").remove();
		//Remove it from the array as well
		var index = this.currentTaskList.indexOf(taskID);
		if (index > -1) {
			this.currentTaskList.splice(index, 1); //Remove the task at index
		}
	};
	ComponentImpl.prototype.getTasks = function () {
		this.container.find("#emptyTaskMsg").hide();
		//Get all tasks, without providing process name, in order to get tasks for subprocess as well
		this.callPcs("GetTasks", this.viewModel.retrieveTasksURL, "Get");
	};
	ComponentImpl.prototype.login = function () {
		this.demoUserId = this.container.find("#uid").val();
		this.demoPassword = this.container.find("#pwd").val();
		this.showWebBarMessage("Your content is loading.", this.assetsURL + "/images/animated_spinner_clock_positive.gif");
		this.getTasks();
		this.removeLogin();
	};
	ComponentImpl.prototype.showWebBarMessage = function (msg, image) {
        var webBarHtml = this.createWebBarTmpl({
			imageSrc: image,
			message: msg
		});
		this.container.find("#webbar").empty();
		this.container.find("#webbar").append(webBarHtml);
	};
	ComponentImpl.prototype.removeWebBarMessage = function () {
		this.container.find("#webbar").empty();
	};
	ComponentImpl.prototype.formatDate = function (isoDate, timezone) {
		var options = { daySpan: 7, dateOnlyAfterDaySpan: true, midstring: true };
		var subjectDate = new Date(isoDate);
		var nowDate = new Date();
		var secDiff = parseInt((nowDate.valueOf() - subjectDate.valueOf()) / 1000, 10);
		var retval;
		if (secDiff >= 0 && secDiff < 60) {//0 to 59 seconds ago
			retval = "<span style=\"color: #ff0000;\">Just now</span>";
		} else if (secDiff >= 60 && secDiff <= 3540) { //1 to 59 minutes ago
			retval = this.getTimeDurationMessage(Math.round(secDiff / 60), true, true, options.midstring); //Round up from 30 second mark
		} else if (secDiff > -60 && secDiff < 0) {//After 0 to 59 minutes
			retval = "<span style=\"color: #ff0000;\">In a minute</span>";
		} else if (secDiff <= -60 && secDiff >= -3540) { //After 1 to 59 minutes
			retval = this.getTimeDurationMessage(Math.round((Math.abs(secDiff)) / 60), true, false, options.midstring); //Round up from 30 second mark
		}

		if (!retval) {
			var DAY_MS = 1000 * 60 * 60 * 24;
			var subjectDays = (subjectDate.valueOf()) / DAY_MS;
			var nowDays = (nowDate.valueOf()) / DAY_MS;
			var dayDiff = parseInt(nowDays, 10) - parseInt(subjectDays, 10);
			if (dayDiff === 0) {
				if (secDiff > 0) {
					//Hours in past
					retval = this.getTimeDurationMessage(Math.round(secDiff / 3600), false, true, options.midstring); //Round up from 30 minute mark
				} else {
					//Hours in future
					retval = this.getTimeDurationMessage(Math.round((Math.abs(secDiff)) / 3600), false, false, options.midstring); //Round up from 30 minute mark
				}
			} else if (dayDiff === 1) {
				retval = "<span style=\"color: #ff0000;\">Yesterday<span style=\"color: #ff0000;\">";
			} else if (dayDiff === -1) {
				retval = "<span style=\"color: #ff0000;\">Tomorrow</span>";
			} else if (Math.abs(dayDiff) < options.daySpan) {
				var localDate = new Date(subjectDate.getTime());
				var day = localDate.getDay().toString();
				var dayStr;
				if (day === "0") {
					dayStr = "Sunday";
				} else if (day === "1") {
					dayStr = "Monday";
				} else if (day === "2") {
					dayStr = "Tuesday";
				} else if (day === "3") {
					dayStr = "Wednesday";
				} else if (day === "4") {
					dayStr = "Thursday";
				} else if (day === "5") {
					dayStr = "Friday";
				} else if (day === "6") {
					dayStr = "Saturday";
				}
				retval = dayStr;
			} else if (options.dateOnlyAfterDaySpan) {
				retval = (options.midstring) ? this.getFormattedDate(subjectDate) : this.getFormattedDate(subjectDate);
			}
		}
		return retval;
	};
	ComponentImpl.prototype.getTimeDurationMessage = function (timeDuration, timeInMinutes, timeInPast, midString) {
		var message;
		if (timeInPast && timeInMinutes) {
			if (timeDuration > 1) {
				message = this.stringFormat("<span style=\"color: #ff0000;\">{1} minutes ago</span>", timeDuration);
			} else {
				message = "<span style=\"color: #ff0000;\">1 minute ago</span>";
			}
		} else if (timeInPast && !timeInMinutes) {
			if (timeDuration > 1) {
				message = this.stringFormat("<span style=\"color: #ff0000;\">{1} hours ago</span>", timeDuration);
			} else {
				message = "<span style=\"color: #ff0000;\">1 hour ago</span>";
			}
		} else if (!timeInPast && timeInMinutes) {
			if (timeDuration > 1) {
				message = this.stringFormat("<span style=\"color: #ff0000;\">In {1} minutes</span>", timeDuration);
			} else {
				message = "<span style=\"color: #ff0000;\">In 1 minute</span>";
			}
		} else if (!timeInPast && !timeInMinutes) {
			if (timeDuration > 1) {
				message = this.stringFormat("<span style=\"color: #ff0000;\">In {1} hours</span>", timeDuration);
			} else {
				message = "<span style=\"color: #ff0000;\">In 1 minute</span>";
			}
		}
		return message;
	};
	ComponentImpl.prototype.getFormattedDate = function (isoDate) {
		var subjectDate = (typeof isoDate === "string") ? Date.parse(isoDate) : isoDate;
		var tzDate = new Date(subjectDate.getTime());
		var month = tzDate.getMonth();
		if (month === 0) {
			month = "January";
		} else if (month === 1) {
			month = "February";
		} else if (month === 2) {
			month = "March";
		} else if (month === 3) {
			month = "April";
		} else if (month === 4) {
			month = "May";
		} else if (month === 5) {
			month = "June";
		} else if (month === 6) {
			month = "July";
		} else if (month === 7) {
			month = "August";
		} else if (month === 8) {
			month = "September";
		} else if (month === 9) {
			month = "October";
		} else if (month === 10) {
			month = "November";
		} else if (month === 11) {
			month = "December";
		}
		var formattedDate = month + " " + tzDate.getDate();
		if (tzDate.getFullYear() > new Date().getFullYear()) {
			formattedDate += ", " + tzDate.getFullYear();
		}
		return formattedDate;
	};
	ComponentImpl.prototype.stringFormat = function (format, args) {

		var tokens = arguments;
		var tokenReplace = function (match, p, offset, format) {
			var tokenNum = parseInt(match.slice(1), 10);
			return tokens[tokenNum];
		};
		return format.replace(/\{\d+\}/g, tokenReplace);
	};
	ComponentImpl.prototype.showLogin = function () {
		var loginHtml = this.createLoginTmpl();
		this.container.append(loginHtml);
		var me = this;
		this.container.find("input[id=loginButton]").button().click(function (event) {
			event.preventDefault();
			me.login();
		});
		this.container.find("#pwd").keypress(function (event) {
			if (event.which === 13) {
				event.preventDefault();
				me.login();
			}
		});
	};
	ComponentImpl.prototype.removeLogin = function () {
		this.container.find("#loginForm").remove();
	};


    ComponentImpl.prototype.createWebBarTmpl = function (tmplObj) {
        var tmpl = '<table>' +
			'	<tr>' +
			'		<td id="webbarImage"><img src="' + tmplObj.imageSrc +'" alt="Web Bar"></td>' +
			'		<td id="webbarMessage"><span class="scs-paragraph-text">' + tmplObj.message +'</span></td>' +
			'	</tr>' +
			'</table>';
        return tmpl;
    };
	ComponentImpl.prototype.createLoginTmpl = function () {
		var tmpl = '<div id="loginForm">' +
			'	<div>' +
			'		<h1 class="scs-title-text">Login to PCS</h1>' +
			'		<div><label class="scs-paragraph-text">Username</label></div>' +
			'		<div><input id="uid" type="text" class="loginfield"/></div>' +
			'		<div><label class="scs-paragraph-text">Password</label></div>' +
			'		<div><input id="pwd" type="password" class="loginfield"/></div>' +
			'		<div><input id="loginButton" class="scs-button-button" value="Login" type="button"/></div>' +
			'		<div id="loginError" class="scs-text"></div>' +
			'	</div>' +						
			'</div>';
		return tmpl;
	};
	ComponentImpl.prototype.createTaskTmpl = function(tmplObj) {
		var tmpl = '<li id="' + tmplObj.taskID + '" processName="' + tmplObj.processName + '">' +
			'<table class="taskRow">' +
			'	<tr>' +
			'		<td>' +
			'			<table><tr><td>' +
			'				<div class="scs-paragraph-text taskName" title="' + tmplObj.title + '">' + tmplObj.title + '</div>';
		if (tmplObj.dueDate !== undefined) {
		tmpl += '			<div class="taskStatus">' +
			'						<span class="scs-text">Due ' + tmplObj.seperator + '</span>' +
			'						<span class="scs-text taskDueDate">' + tmplObj.dueDate + '</span>' +
			'					</div>';
		}
		tmpl += '	</td></tr></table>' +
			'		</td>' +
			'		<td>' +
			'			<table><tr>';
		if (tmplObj.priority <= 2) {
		tmpl += '		<td><img title="High Priority" src="' + tmplObj.priorityIcon +'" alt="High Priority"/></td>';
		} else {
		tmpl += '		<td width="16px"></td>';
		}
		tmpl += '		<td>' +
			'					<img class="arrowIcon" src="' + tmplObj.defaultArrowIcon +'" alt="Arrow Icon"/>' +
			'				</td>' +
			'			</tr></table>' +
			'		</td>' +
			'	</tr>' +
			'</table>' +
			'</li>';
		return tmpl;
	};
    ComponentImpl.prototype.createAutoRunResultTmpl = function (tmplObj) {
        var tmpl = '<tr>' +
            '	<td class="scs-text">' + tmplObj.taskName + '</td>' +
            '</tr>';
        return tmpl;
    };
	ComponentImpl.prototype.createAutoRunTmpl = function () {
        var tmpl = '<div id="autorunContent">' +
            '	<h1 class="scs-title-text">Completed tasks</h1>' +
            '	<div>' +
            '		<table id="autorunResults" class="table table-striped">' +
            '		</table>' +
            '	</div>' +
            '</div>';
		return tmpl;
    };
	ComponentImpl.prototype.showAutoRunContent = function () {
        var autoRunHtml = createAutoRunTmpl();
		this.container.append(autoRunHtml);
	};
	ComponentImpl.prototype.removeAutoRunContent = function () {
		if (this.container.find("#autorunContent").length > 0) {
			this.container.find("#autorunContent").remove();
		}
	};
	ComponentImpl.prototype.getAuthToken = function (pcsServer) {
		console.log("call getAuthToken. pcsBaseUrl = " + pcsServer);
		var me = this;
		PCSAuth.getPcsAuthToken(pcsServer, function (data) {
			var parsed = $.parseJSON(data);
			console.log("parsed response. parsed.token = " + parsed.token + ",   parsed.statusCode = " + parsed.statusCode);
			me.OAuthToken = parsed.token;
			var errorCode = parsed.statusCode;
			if (errorCode === "-1") {
				//Failed to get OAuth token
				me.removeWebBarMessage();
				console.log("Unable to authorize using OAuth token.");
				//Switch to basic authentication
				me.authType = "Basic";
				me.showLogin();
			} else {
				me.getTasks();
			}
		});
	};
	ComponentImpl.prototype.initPcsTaskViewer = function () {
		this.container.find("#taskContent").hide();
		this.removeAutoRunContent();
		this.showWebBarMessage("Your content is loading.", this.assetsURL + "/images/animated_spinner_clock_positive.gif");
		//Attach event listener to auto run. The event could be triggrred outside this app in iframe
		console.log("add event listener for Autorun_PCS_Task_Viewer");
		addEventListener("message", (function (param) {
			return function (event) {
				param.autoRunProcess(event, param);
			};
		})(this));
		var pcsServer = this.viewModel.retrieveTasksURL;
		if (this.viewModel.retrieveTasksURL[this.viewModel.retrieveTasksURL.length - 1] !== "/") {
			this.viewModel.retrieveTasksURL += "/";
		}
		this.viewModel.retrieveTasksURL = this.viewModel.retrieveTasksURL + "ic/api/process/v1/tasks?assignment=" + this.viewModel.taskAssignment;
		if (this.viewModel.pcsProcessName !== "") {
			//Append process name to url
			this.viewModel.retrieveTasksURL = this.viewModel.retrieveTasksURL + "&process=" + this.viewModel.pcsProcessName;
		}

		this.getAuthToken(pcsServer);
	};
	// ----------------------------------------------
	// Create the factory object for your component
	// ----------------------------------------------
	var componentFactory = {
		createComponent: function (args, callback) {
			// return a new instance of the component
			return callback(new ComponentImpl(args));
		}
	};
	return componentFactory;
});