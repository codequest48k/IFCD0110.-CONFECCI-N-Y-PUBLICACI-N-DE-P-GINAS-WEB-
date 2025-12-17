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
            contentClient.getItem({
                "id": content.id
            }).then(
                function (itemdata) {
                    itemdata.scsData = content.scsData;
                    //
                    // Handle fields specific to this itemdata type.
                    //
                    var fields = itemdata.fields;
                    var richtext = fields.query_description;
                    var semirichtext = richtext.replace(/&nbsp;/g, '');
                    var plaintext = $("<div></div>").html(semirichtext).text();
                    fields.QueryDescription = plaintext;
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
