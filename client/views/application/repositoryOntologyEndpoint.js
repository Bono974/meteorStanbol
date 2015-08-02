var marmottaURL = "http://localhost:8080/marmotta";

Session.setDefault('cursor', 0);
Meteor.autorun(function(){
    Meteor.subscribe("resultSPARQLHeaders");
    Meteor.subscribe("resultSPARQL", Session.get('cursor'));
    Meteor.subscribe("resultSPARQLPredicates");
    Meteor.subscribe("resultSPARQLMappings");
});

Meteor.startup(function () {
    refreshListOnto();
});

Template.repositoryOnto.helpers({
    "listOntos": function() {
        var str = Session.get('listOnto');
        return str;
    }, "rowResultQuery": function() {
        var results = QueryResult.find({});
        return results;
    }, "headerResultQuery": function() {
        var headers =  HeaderResult.find({});
        return headers;
    }, "currentEntity": function() {
        var currentEntity = Router.current().params.query.currentEntity;
        Session.set("currentEntity", currentEntity);
        Meteor.call("getEntityPredicates", currentEntity);
        return currentEntity;
    }, 'escapeEntity': function(entity) {
        return encodeURIComponent(entity);
    }, "currentEntityPredicates": function() {
        var predicates = PredicatesResult.find({});
        return predicates;
    }, "currentEntityMappings": function() {
        var mappings = MappingsResult.find({});
        return mappings;
    }
});

Template.EditorPage.helpers({
    "editorOptions": function() {
        return {
            lineNumbers: true,
            mode: "sparql",
            theme: "monokai"
        };
    }, "editorCode": function() {
        return "SELECT * WHERE {?s ?p ?o} LIMIT 10";
    }
});

Template.metadata.helpers({
    "METAS": function() {
        var str = Session.get('META');

        var parsed = JSON.parse(str);
        var arr = [];
        for(var x in parsed)
            arr.push( "--" + x + " : " + parsed[x]);
        return arr;
    }, "ontoSelect": function() {
        return Session.get('ontoSelected');
    }
});


function refreshListOnto() {
    Meteor.call('getListOnto', function(error, results) {
        var ontologies = [];
        var tmp = JSON.parse(results.content);
        for (var cur in tmp) {
            ontologies.push(tmp[cur].uri);
        }
        Session.set('listOnto', ontologies);
        return ontologies;
    });
}

Template.repositoryOnto.events({
    "click button[value=open]": function(event, t){
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        Session.set('ontoSelected', onto);
        Meteor.call('getMetaOnto', onto, function(error, results) {
            console.log(results.content);
            Session.set('META', results.content);
            return results.content;
        });
    }, "click button[value=delete]": function(event, t){
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        if (confirm("Êtes vous sûr de vouloir supprimer l'ontologie " + onto + " du dépôt ?")) {
            Meteor.call('deleteOnto', onto, function(errors, results) {
                console.log("Ontology :"+ onto + " deleted from the repository");
                refreshListOnto();
            });
        }
    }, "click button[value=addOntology]": function(event, t) {
        event.preventDefault();
        var onto = t.$('form.addOntology input[name=ontology]')[0].files[0];
        var format = t.$("form.addOntology select[name=format]").val();
        var context = t.$("form.addOntology input[name=context]").val();

        if (context === "") {
            alert("Choississez un nom pour le graphe RDF à importer!");
            return;
        } else if (typeof onto === "undefined") {
            alert("Pas de fichier sélectionné !");
            return;
        }

        var url = marmottaURL + "/import/upload?context=" + context;

        var form = new FormData({
            version: "1.0.0-rc1"
        });

        $.ajax({
            url: url,
            type: "POST",
            data: onto,
            contentType: format,
            success: function(res) {
                //console.log(res);
                console.log("Ontology : "+ onto.name + " added from the repository");
                refreshListOnto();
            },
            error: function(xhr){
                console.log(xhr);
                alert("Erreur dans l'ajout de l'ontologie "+onto.name+" avec le format "+ format + " essayez avec un autre format");
            },
            processData: false  // tell jQuery not to process the data
                //contentType: false   // tell jQuery not to set contentType
        });
    }, 'click button[value=runQuery]': function(event, t) {
        event.preventDefault();
        var query = Session.get("queryUserSPARQL");
        Meteor.call("getSPARQLResultUser", query, function(err, results) {
            console.log(query);
            console.log(results);
        });
    }, 'click .previousResults': function(event, t) {
        event.preventDefault();
        if (Number(Session.get('cursor')) > 19)
            Session.set('cursor', Number(Session.get('cursor')) - 20);
        console.log(Session.get('cursor'));
    }, 'click .nextResults': function(event, t) {
        event.preventDefault();
        Session.set('cursor', Number(Session.get('cursor')) + 20);
        console.log(Session.get('cursor'));
    }
});
