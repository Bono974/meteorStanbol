var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost:5984";

Meteor.call('getListRessources', function(error, results) {
    Session.set('ressources', results);
    return results.content;
});

Template.repositoryRessource.enhancerRES = function() {
    var str = Session.get('enhancedContent');
    return str;
};

Template.repositoryRessource.listRessources = function() {
    var str = Session.get('ressources');
    return str.split(',');
};

Template.metaRessource.ressourceSelect = function() {
    var str = Session.get('ressourceSelected');
    return str;
};

Template.metaRessource.METAressources = function() {
    var str = Session.get('ressourceMETA');
    return str;
};

Template.enhancer.enhancedContent = function() {
    var str = Session.get('enhancedContent');
    return str;
}
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

Template.enhancer.listChains = function() {
    var str = Session.get('chains');
    return str;
};

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

function processFileToCouchDB(filename, author, ressourceToAnnotate){ // FIXME : AND ADD TO COUCHDB
    var chain = $("form.chooseEnhancerChain select[name=chain]")[0]; // TODO : change
    chain = chain[chain.selectedIndex].value;
    var url = stanbolURL + "/enhancer/chain/" + chain;


    function success(res) {
        console.log(res);
        addRessourceAnnotated(filename, author, ressourceToAnnotate, res);
    }

    function error(xhr) {
        console.log(xhr);
        console.log("Enhancement failed, redo again with another chain ? -- No new document created in CouchDB");
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
    function addAttachment(filename, author, rev, id, ressource) {
        Meteor.call("addAttachment", filename, author, rev, id, ressource, function(errors, results) {
            console.log("Document à modifier: " + filename + " rev: " + rev + " id:" + id);
            console.log("Auteur: " + author);
            console.log("HTML5 input file: " + ressource);

            console.log("------------");
            console.log(ressource);

        });
    }
    Meteor.call("checkRessource", filename, author, function(errors, results) {
        console.log(results);
        if (results.checked == true) {
            // document already exists with same name
            // ask another name ?
            // ask if we do another enhancement with another chain ?
            // ask if we erase attachment ?
            if (confirm("Un document au nom de " + filename + " est déjà présent dans la BDD par " + results.author + "avec la même ou une différente pièce jointe. Souhaitez vous le remplacer par le document choisi ? ")) {
                // do something
                console.log(ressource);

                var rev = results.rev;
                var id = results.id;

                var extendedRessource = {
                    name : ressource.name,
                    type : ressource.type,
                };
                // TODO : Modify enhancement field
                addAttachment(filename, author, rev, id, extendedRessource);
            } else {
                // do nothing, let user change his entries
            }
        }
        else {
            Meteor.call("addRessource", filename, author, enhancement, function(errors, results) {
                Meteor.call("checkRessource", filename, author, function(errors, results) {
                    var rev = results.rev;
                    var id = results.id;
                    console.log(ressource);
                    var extendedRessource = {
                        name : ressource.name,
                        type : ressource.type,
                    };
                    addAttachment(filename, author, rev, id, extendedRessource);
                });
            });
        }
    });
}

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
            // Upload in temporary server folder then upload as attachment to doc in CouchDB
            // check if ressource already been uploaded
            var reader = new FileReader();
            reader.onload = function(fileLoadEvent) {
                var name = ressource.name.toString();
                Meteor.call('fileUpload', name, reader.result);
            };
            reader.readAsBinaryString(ressource);
            processFileToCouchDB(filename, author, ressource);  // FIXME : AND ADD TO COUCHDB
        }
    }
});
