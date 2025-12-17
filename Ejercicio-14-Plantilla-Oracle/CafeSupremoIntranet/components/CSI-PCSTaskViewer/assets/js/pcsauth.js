/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

define(["jquery"], function ($) {
	return {
		getPcsAuthToken: function (pcsBaseUrl, callback) {
			var url = pcsBaseUrl + '/ic/process/workspace/auth/token';

			console.log('(AUTH): ' + url);

			// inialized the PCS connection
			var pcsResourceURL = pcsBaseUrl + '/ic/process/workspace/internal/cors-iframe-bootstrap.html';
			this.initializePCSConnection(pcsBaseUrl, pcsResourceURL).then(function () {
				$.ajax({
					type: 'GET',
					url: url,
					async: true,
					xhrFields: {
						withCredentials: true
					},
					dataType: "text"
				}).done(function (data, textStatus, jqXHR) {

					console.log('(AUTH): data = ' + data);

					var ct = jqXHR.getResponseHeader("content-type") || "";

					// if the response was an HTML Form....
					if (ct.indexOf('html') > -1) {
						// not logged in - got a form from the re-direct

						// parse the form and submit it
						var parser = new DOMParser(),
							htmlDoc = parser.parseFromString(data, "text/html"),
							forms = htmlDoc.getElementsByTagName("form");
						if (forms.length === 1) {
							var f = forms[0];
							$.post(f.action, $(f).serialize(), function (resp) {
								// retry getting the token now form has ben submitted
								$.ajax({
									'type': 'GET',
									'url': url,
									'dataType': 'text',
									'xhrFields': {
										'withCredentials': true
									},
									'success': function (token) {
										// return the token
										callback(token);
									}
								}).fail(function (jqXHR, textStatus, errorThrown) {
									console.log("fail: xhr = " + jqXHR.toString() + " status: " + textStatus + " error: " + errorThrown);

									callback(JSON.stringify({
										'token': 'none',
										'statusCode': '-1',
										'statusText': jqXHR.statusText
									}));
								});
							}).fail(function (jqXHR, textStatus, errorThrown) {
								console.log("fail: xhr = " + jqXHR.toString() + " status: " + textStatus + " error: " + errorThrown);

								callback(JSON.stringify({
									'token': 'none',
									'statusCode': '-1',
									'statusText': jqXHR.statusText
								}));
							});
						}
					} else {
						// already logged in
						// return the token
						callback(JSON.stringify({
							'token': data,
							'statusCode': '1',
							'statusText': 'none'
						}));
					}
				}).fail(function (jqXHR, textStatus, errorThrown) {
					console.log("fail: xhr = " + jqXHR.toString() + " status: " + textStatus + " error: " + errorThrown);

					callback(JSON.stringify({
						'token': 'none',
						'statusCode': '-1',
						'statusText': jqXHR.statusText
					}));
				});
			});
		},
		initializePCSConnection: function (serverURL, resourceURL) {
			if (!window.SCS_pcsInitializationPromise) {
				window.SCS_pcsInitializationPromise = new Promise(function (resolve, reject) {
					// create a listener to wait on the PCS initialization message
					var handleMessage = function (event) {
						// handle only PCS events
						if (event.origin === serverURL) {
							// confirm the message
							try {
								var message = JSON.parse(event.data);
								if (message && message.resourceInitialization) {
									// expected message, resolve with the status
									resolve(message.resourceInitialization.status);
								} else {
									// not expected initialization message, ignore
								}
							} catch (e) {
								if (event.data === 'loaded') {
									resolve(event.data);
								} else {
									// not expected initialization message, ignore
								}
							}
						}
					};
					window.addEventListener('message', handleMessage, false);

					// create an iframe for the PCS resource to return the initialization messsage
					var pcsIframe = $('<iframe src="' + resourceURL + '" style="width:0px;height:0px;display:none">');
					$('body').append(pcsIframe);
				});
			}

			// return the promise
			return window.SCS_pcsInitializationPromise;
		}
	};
});