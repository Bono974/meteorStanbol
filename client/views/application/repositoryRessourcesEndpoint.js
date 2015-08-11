var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost:5984";

var Ressources = new FS.Collection("ressources", {
  stores: [new FS.Store.FileSystem("ressources")]
});

Meteor.startup(function () {
    Meteor.call('getListRessources', function(error, results) {
        refreshListRessources(results);
    });

    var query = "PREFIX enhancer: <http://stanbol.apache.org/ontology/enhancer/enhancer#> \n" +
        "PREFIX rdfs:     <http://www.w3.org/2000/01/rdf-schema#> \n" +
        "SELECT distinct ?name ?chain " +
        "WHERE { " +
        "?chain a enhancer:EnhancementChain. \n" +
        "?chain rdfs:label ?name .\n" +
        "} " +
        "ORDER BY ASC(?name) ";

    function success(res) {
        var chains = $('binding[name=name] literal', res).map(function () {
            return this.textContent;
        }).toArray();
        if (_(chains).indexOf('default') != -1) {
            chains = _.union(['default'], chains);
        }
        Session.set('chains', chains);
        return chains;
    }
    function error(xhr) {
        Session.set('chains', xhr);
        return xhr;
    }
    var uri = stanbolURL + "/enhancer/sparql";

    $.ajax({
        type: "POST",
        url: uri,
        data: {query: query},
        accepts: {'application/json': 'application/sparql-results+json'},
        success: success,
        error: error
    });
});

function refreshListRessources(results) {
    //FIXME :does not update template
    var res = [];
    for (var i = 0; i < results.rows.length; i++)
        res.push(results.rows[i].id);
    Session.set("ressources", res);
    console.log(res);
    return res;
}

Template.ressourcePage.helpers({
    "editorOptions": function() {
        return {
            lineNumbers: true,
            mode: "javascript",
            theme: "solarized dark"
        };
    }
});

Template.repositoryRessource.helpers({
    "enhancerRES": function() {
        return Session.get('enhancedContent');
    }, "listRessources": function() {
        return Session.get('ressources');
    }, "doc": function() {
        return JSON.stringify(Session.get('docSelected'), null, 2);
    }, "progressADD": function() {
        return Session.get('ressourceSelected');
    }
});

Template.uploadRessource.helpers({
    "enhancedContent": function() {
        return Session.get('enhancedContent');
    }, "listChains": function() {
        return Session.get('chains');
    }, "progressFile": function() {
        return Session.get("fileUpload");
    }
});

Template.repositoryRessource.events({
    "click button[value=open]": function(event, t){
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        Session.set('ressourceSelected', ressource);

        Meteor.call('getRessource', ressource, function(errors, results) {
            console.log(results);
            Session.set('docSelected', JSON.stringify(results.doc, null, 2));
        });
    }, "click button[value=delete]": function(event, t){
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        if (confirm("Are you sure to delete " + ressource + " from doc_repository AND from his annotations stored stored into the triple store ?")) {
            //TODO : Delete his annotations stored into Marmotta as well !
            Meteor.call('deleteRessource', ressource);
            Meteor.call('getListRessources', function(error, results) {
                return refreshListRessources(results);
            });
        }
    } , "click button[value=addToMarmotta]": function(event, t) {
        event.preventDefault();
        if (confirm("Do you really want to add these annotations into the triplestore ?")) {
            var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
            Session.set('ressourceSelected', ressource);
            Meteor.call('addEnhancementsToRepo', ressource, function(errors, results){
                if (errors)
                    console.log(errors);
                else
                    console.log(results);
                Session.set('ressourceSelected', Session.get('ressourceSelected')+"'s annotations added.");
            });
        }
    }
});

Template.uploadRessource.events({
    "click button[value=addRessource]": function(event, t) {
        event.preventDefault();
        var filename = t.$("form.addRessource input[name=filename]").val();
        var author = t.$("form.addRessource input[name=author]").val();
        var ressource = t.$("form.addRessource input[type=file]")[0].files[0];

        if (filename === "" || author === "") {
            alert("Pleaser enter a name for the ressource, and who you are !");
            return;
        } else if (typeof ressource === "undefined") {
            alert("No file was selected !");
            return;
        } else {
            // TODO : couchdb view ?
            // check if ressource already been uploaded with another or same chain
            processFileToCouchDB(filename, author, ressource);
            Session.set("fileUpload", filename);
        }
    }
});

function uploadFile(ressource) {
    //Ressources.insert(ressource, function (err, fileObj) {
    //    // Inserted new doc with ID fileObj._id, and kicked off the data upload using HTTP
    //    console.log(err);
    //    console.log(fileObj);
    //  });

    var reader = new FileReader();
    reader.onload = function(fileLoadEvent) {
        var name = ressource.name.toString();
        Meteor.call('fileUpload', name, reader.result);
    };
    reader.readAsBinaryString(ressource);
}

function processFileToCouchDB(filename, author, ressourceToAnnotate){
    Meteor.call("checkRessource", filename, function(errors, results) {
        if (results.checked == true) {
            if (confirm("Souhaitez vous écraser les annotations existantes (versionnées TODO) et le document attaché ?")) {
                uploadFile(ressourceToAnnotate);

                var settings = {
                    type: "update",
                    id: results.id,
                    rev: results.rev,
                    filename: filename,
                    author: author
                };
                enhanceRessource(ressourceToAnnotate, settings);
            } else return; // do nothing, let user change his entries
        } else {
            uploadFile(ressourceToAnnotate);

            var settings = {
                type: "new",
                id: results.id,
                filename: filename,
                author: author
            };
            enhanceRessource(ressourceToAnnotate, settings);
        }
        Session.set("fileUpload", Session.get("fileUpload") + " uploaded !");
    });
}

function enhanceRessource(ressourceToAnnotate, settings) {
    var chain = $("form.addRessource select[name=chain]")[0];
    chain = chain[chain.selectedIndex].value;
    var url = stanbolURL + "/enhancer/chain/" + chain;

    function success(res) {
        var extendedRessource = {
            name : ressourceToAnnotate.name,
            type : ressourceToAnnotate.type
        };
        if (settings.type === "update") {
            Meteor.call("updateEnhancementAndRessource", settings, res, extendedRessource);
        } else if (settings.type === "new") {
            Meteor.call("addRessourceAnnotated",
                    settings.filename,
                    settings.author,
                    extendedRessource,
                    res,
                    function(errors, results) {
                        //console.log(results);
                    });
        }
    }
    function error(xhr) {
        console.log(xhr);
        console.log("Enhancement failed, do it again with another chain ? -- No new document created in CouchDB");
    }
    $.ajax({
        url: url,
        type: "POST",
        data: ressourceToAnnotate,
        accept: 'application/json',
        success: success,
        error: error,
        processData: false,  // tell jQuery not to process the data
        contentType: false   // tell jQuery not to set contentType
    });
}
