var marmottaURL = "http://localhost:8080/marmotta";


Session.setDefault('cursor', 0);
Session.setDefault('cursorRight', 0);
Session.setDefault('cursorLeft', 0);
Session.setDefault('cursorMappings', 0);

Meteor.autorun(function(){
    Meteor.subscribe("resultSPARQLHeaders");
    Meteor.subscribe("resultSPARQL", Session.get('cursor'));
    Meteor.subscribe("resultSPARQLPredicates");
    Meteor.subscribe("resultSPARQLMappings", Session.get('cursorMappings'));

    Meteor.subscribe("resultSPARQLEntityRight", Session.get('cursorRight'));
    Meteor.subscribe("resultSPARQLEntityLeft", Session.get('cursorLeft'));
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
    }, "rowResultQueryEntityRight": function() {
        var right = QueryResultEntityRight.find({});
        return right;
    }, "rowResultQueryEntityLeft": function() {
        var left = QueryResultEntityLeft.find({});
        return left;
    }, "headerResultQuery": function() {
        var headers =  HeaderResult.find({});
        return headers;
    }, "currentEntity": function() {
        var currentEntity = Router.current().params.query.currentEntity;
        var currentPredicate = Router.current().params.query.currentPredicate;
        if (Session.get("currentEntity") != currentEntity) {
            Meteor.call("updateCurrentEntityMetadata", currentEntity, function(err, results) {
                Session.set("currentEntity", currentEntity);
            });
        }
        //if (typeof(currentPredicate) != "undefined")
        //    Meteor.call("getEntitiesByPredicate", currentEntity, currentPredicate);
        return currentEntity;
    }, "escapeEntity": function(entity) {
        return encodeURIComponent(entity);
    }, "currentEntityLabel": function() {
        var currentEntity = Session.get("currentEntity");
        Meteor.call("getEntityLabel", currentEntity, function(err, results) {
            console.log(results);
            Session.set("currentEntityLabel", results);
        });
        return Session.get("currentEntityLabel");
    }, "currentEntityPredicates": function() {
        var predicates = PredicatesResult.find({});
        return predicates;
    }, "resultMap": function(value) {
        var headers =  HeaderResult.find({}).fetch();
        var res = [];

        for(var cur in headers) {
            var curHeader = headers[cur].header;
            res.push(value[0][curHeader].value);
        }
        return res;
    }
});

Template.MappingsAvailable.helpers({
    "escapeEntity": function(entity) {
        return encodeURIComponent(entity);
    }, "currentEntityMappings": function() {
        var mappings = MappingsResult.find({});
        return mappings;
    }
});

Template.MappingsAvailable.events({
    'click .previousResultsMappings': function(event, t) {
        event.preventDefault();
        if (Number(Session.get('cursorMappings')) > 19)
            Session.set('cursorMappings', Number(Session.get('cursorMappings')) - 20);
    }, 'click .nextResultsMappings': function(event, t) {
        event.preventDefault();
        Session.set('cursorMappings', Number(Session.get('cursorMappings')) + 20);
    }
});

Template.EditorPage.helpers({
    "editorOptions": function() {
        return {
            lineNumbers: true,
            mode: "sparql",
            theme: "solarized dark"
        };
    }, "editorCode": function() {
        return "SELECT * WHERE {?s ?p ?o} LIMIT 10";
    }
});

Template.metadata.helpers({
    "METAS": function() {
        var str = Session.get('META');
        if (typeof(str) != "undefined") {

            var parsed = JSON.parse(str);
            var arr = [];
            for(var x in parsed)
                arr.push( "--" + x + " : " + parsed[x]);
            return arr;
        }
        return "";
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
    }, 'click .nextResults': function(event, t) {
        event.preventDefault();
        Session.set('cursor', Number(Session.get('cursor')) + 20);
    }, 'change select[name=ontologyOverview]': function(event, t) {
        event.preventDefault();
        var ont = $('select[name=ontologyOverview]')[0];
        ont = ont[ont.selectedIndex].value;
        var query =
            "SELECT *\n" +
            "FROM <"+ont+">\n"+
            "WHERE {\n"+
            "\t?subject ?predicate ?object\n"+
            "}\n"+
            "LIMIT 1000\n";
        Session.set('queryUserSPARQL', query);
    }, 'click .previousResultsRight': function(event, t) {
        event.preventDefault();
        if (Number(Session.get('cursorRight')) > 19)
            Session.set('cursorRight', Number(Session.get('cursorRight')) - 20);
    }, 'click .nextResultsRight': function(event, t) {
        event.preventDefault();
        Session.set('cursorRight', Number(Session.get('cursorRight')) + 20);
    }, 'click .previousResultsLeft': function(event, t) {
        event.preventDefault();
        if (Number(Session.get('cursorLeft')) > 19)
            Session.set('cursorLeft', Number(Session.get('cursorLeft')) - 20);
    }, 'click .nextResultsLeft': function(event, t) {
        event.preventDefault();
        Session.set('cursorLeft', Number(Session.get('cursorLeft')) + 20);
    }, 'click .previousResultsMappings': function(event, t) {
        event.preventDefault();
        if (Number(Session.get('cursorMappings')) > 19)
            Session.set('cursorMappings', Number(Session.get('cursorMappings')) - 20);
    }, 'click .nextResultsMappings': function(event, t) {
        event.preventDefault();
        Session.set('cursorMappings', Number(Session.get('cursorMappings')) + 20);
    }
});
