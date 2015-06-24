var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost:5984";

Meteor.startup(function () {
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
        //cb(null, chains);
        Session.set('chains', chains);
        return chains;
    }
    function error(xhr) {
        //cb(xhr);
        Session.set('chains', xhr);
        return xhr;
    }

    var uri = stanbolURL + "/enhancer/sparql";

    $.ajax({
        type: "POST",
        url: uri,
        data: {query: query},
            // accepts: ["application/json"],
        accepts: {'application/json': 'application/sparql-results+json'},
            // dataType: "application/json",
        success: success,
        error: error
    });
});

Meteor.call('getListRessources', function(error, results) {
    Session.set('ressources', results);
    return results.content;
});

Template.repositoryRessource.helpers({
    "enhancerRES": function() {
        return Session.get('enhancedContent');
    },
    "listRessources": function() {
        var str = Session.get('ressources');
        return str.split(',');
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

Template.enhancer.helpers({
    "enhancedContent": function() {
        return Session.get('enhancedContent');
    },
    "listChains": function() {
        var str = Session.get('chains');
        return str;
    }
});

Template.repositoryRessource.events({
    "click button[value=open]": function(event, t){
        //code for submit
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        Session.set('ressourceSelected', ressource);

    },
    "click button[value=delete]": function(event, t){
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        if (confirm("Êtes vous sûr de vouloir supprimer le fichier " + ressource + " du dépôt ?")) {
            Meteor.call('deleteRessource', ressource, function(error, results) {
                console.log(results);
            });
            Meteor.call('getListRessources', function(error, results) {
                Session.set('ressources', results);
                return results;
            });
        }
    }
});

Template.enhancer.events({
    "click button[value=enhancerProcess]": function(event, t) {
        event.preventDefault();

        var ressourceToAnnotate = $('input[name=ressource]')[0].files[0];
        var chain = t.$("form.chooseEnhancerChain select[name=chain]")[0];
        chain = chain[chain.selectedIndex].value;
        var url = stanbolURL + "/enhancer/chain/" + chain;

        function prettyPrint() {
            var ugly = document.getElementById('myTextArea').value;
            var obj = JSON.parse(ugly);
            var pretty = JSON.stringify(obj, undefined, 4);
            document.getElementById('myTextArea').value = pretty;
        }

        function success(res) {
            console.log(res);
            Session.set("enhancedContent", JSON.stringify(res));
        } // TODO : --> CouchDB
        function error(xhr) { console.log(xhr); }

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
            // TODO : couchdb view ? check if ressource already been uploaded
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
    var chain = $("form.chooseEnhancerChain select[name=chain]")[0]; // FIXME : change
    chain = chain[chain.selectedIndex].value;
    var url = stanbolURL + "/enhancer/chain/" + chain;

    function success(res) {
        console.log(res);
        addRessourceAnnotated(filename, author, ressourceToAnnotate, res);
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

function addRessourceAnnotated(filename, author, ressource, enhancement) {
    Meteor.call("checkRessource", filename, author, function(errors, results) {
        if (results.checked == true) {
            // document already exists with same name
            // ask another name ?
            // ask if we do another enhancement with another chain ?
            // ask if we erase attachment ?
            if (confirm("Un document au nom de " + filename + " est déjà présent dans la BDD par " +
                        " FIXME " +
                        "avec la même ou une différente pièce jointe. "
                        + "Souhaitez vous le remplacer par le document choisi ? ")) {

                var rev = results.rev;
                var id = results.id;

                var extendedRessource = {
                    name : ressource.name,
                    type : ressource.type,
                };
                // TODO : Modify enhancement field
                Meteor.call("addAttachment", filename, author, rev, id, extendedRessource);

            } else return; // do nothing, let user change his entries
        }
        else {
            var extendedRessource = {
                name : ressource.name,
                type : ressource.type,
            };
            Meteor.call("addRessourceAnnotated",
                    filename,
                    author,
                    xtendedRessource,
                    enhancement,
                    function(errors, results) {
                        console.log(results);
                    });
        }
    });
}
