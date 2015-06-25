var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost:5984";

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

Template.repositoryRessource.helpers({
    "enhancerRES": function() {
        return Session.get('enhancedContent');
    },
    "listRessources": function() {
        return Session.get('ressources');
    },
});

Template.metaRessource.helpers({
    "METAressources": function() {
        return Session.get('ressourceMETA');
    },
    "ressourceSelected": function() {
        return Session.get('ressourceSelected');
    }
});

Template.uploadRessource.helpers({
    "enhancedContent": function() {
        return Session.get('enhancedContent');
    },
    "listChains": function() {
        return Session.get('chains');
    }
});

Template.repositoryRessource.events({
    "click button[value=open]": function(event, t){
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        Session.set('ressourceSelected', ressource);
    },
    "click button[value=delete]": function(event, t){
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        if (confirm("Êtes vous sûr de vouloir supprimer le fichier " + ressource + " du dépôt ?")) {
            Meteor.call('deleteRessource', ressource);
            Meteor.call('getListRessources', function(error, results) {
                return refreshListRessources(results);
            });
        };
    }
});

Template.uploadRessource.events({
    "click button[value=addRessource]": function(event, t) {
        event.preventDefault();
        var filename = t.$("form.addRessource input[name=filename]").val();
        var author = t.$("form.addRessource input[name=author]").val();
        var ressource = t.$("form.addRessource input[type=file]")[0].files[0];

        if (typeof ressource === "undefined") {
            alert("Il n'y a aucun fichier selectionné !");
            return;
        } else {
            // TODO : couchdb view ?
            // check if ressource already been uploaded with another or same chain
            var reader = new FileReader();
            reader.onload = function(fileLoadEvent) {
                var name = ressource.name.toString();
                var buffer = new Uint8Array(reader.result)
                Meteor.call('fileUpload', name, buffer);
            };
            reader.readAsArrayBuffer(ressource);
            processFileToCouchDB(filename, author, ressource);
        }
    }
});

function processFileToCouchDB(filename, author, ressourceToAnnotate){
    Meteor.call("checkRessource", filename, function(errors, results) {
        if (results.checked == true) {
            if (confirm("Souhaitez vous écraser les annotations existantes (versionnées TODO) et le document attaché ?")) {
                var settings = {
                    type: "update",
                    id: results.id,
                    rev: results.rev,
                    filename: filename,
                    author: author
                };
                enhanceRessource(ressourceToAnnotate, settings);
            } else return; // do nothing, let user change his entries
        }
        else {
            var settings = {
                type: "new",
                id: results.id,
                filename: filename,
                author: author
            };
            enhanceRessource(ressourceToAnnotate, settings);
        }
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
