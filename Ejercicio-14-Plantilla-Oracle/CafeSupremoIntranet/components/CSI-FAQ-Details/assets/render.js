/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* globals define,console */
define([
    "jquery",
    "mustache",
    "text!./layout.html",
    "css!./design.css"
], function ($, Mustache, MediaLayout, css) {
    "use strict";
    // Content Layout constructor function.
    function ContentLayout(params) {
        this.contentItemData = params.contentItemData || {};
        this.scsData = params.scsData;
        this.contentClient = params.contentClient;
    }
    function dateToMDY(date) {
        if (!date) {
            return "";
        }

        var dateObj = new Date(date);

        var options = {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        };
        var formattedDate = dateObj.toLocaleDateString("en-US", options);

        return formattedDate;
    }
    // Content Layout definition.
    ContentLayout.prototype = {
        // Specify the versions of the Content REST API that are supported by the this Content Layout.
        // The value for contentVersion follows Semantic Versioning syntax.
        // This allows applications that use the content layout to pass the data through in the expected format.
        contentVersion: ">=1.1.0 <2.0.0",
        // Main rendering function:
        // - Updates the data to handle any required additional requests and support both v1.0 and v1.1 Content REST APIs
        // - Expand the Mustache template with the updated data
        // - Appends the expanded template HTML to the parentObj DOM element
        render: function (parentObj) {
            var content = $.extend({}, this.contentItemData),
                contentClient = this.contentClient;

            // If used with CECS Sites, Sites will pass in context information via the scsData property
            content = $.extend(content, {
                "scsData": this.scsData
            });
            // Query the item again to get the rich text fields.
            // This is required since a content query does not return large text fields.
            var that = this;
            contentClient.getItem({
                "id": content.id
            }).then(
                function (itemdata) {
                    itemdata.scsData = content.scsData;
                    //
                    // Handle fields specific to this itemdata type.
                    //
                    var fields = itemdata.fields;
                    fields.formattedpublishedDate = "Published " + dateToMDY(itemdata.createdDate.value);
                    fields.formattedupdatedDate = "Updated " + dateToMDY(itemdata.updatedDate.value);
                    fields.emailLink = "mailto:?subject=" + fields.query.replace(/&/g, "%26") + "&body=" + window.location.href.replace(/&/g, "%26");

                    // We also need to expand the rich text macros for the query_description field
                    fields["query_description"] = that.contentClient.expandMacros(fields["query_description"]);
                    try {
                        var template = Mustache.render(MediaLayout, itemdata);
                        // Insert the expanded template into the passed in container.
                        if (template) {
                            $(parentObj).append(template);
                        }

                    } catch (e) {
                        console.error(e.stack);
                    }
                });
        }
    };
    return ContentLayout;
});
