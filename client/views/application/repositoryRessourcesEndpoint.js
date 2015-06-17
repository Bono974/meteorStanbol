var stanbolURL = "http://localhost:8081";
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
    console.log(str);
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

Template.repositoryRessource.events({
    "click button[value=open]": function(event, t){
        //code for submit
        event.preventDefault();
        var ressource = t.$("form.getMetaRessource select[name=ressource]").val();
        Session.set('ressourceSelected', ressource);
        Meteor.call('getMetaRessource', ressource, function(error, results) {
            Session.set('ressourceMETA', results);
            //Session.set('enhancedContent', results.enhanced);
            return results;
        });
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
    },
    "click button[value=addRessource]": function(event, t) {
        event.preventDefault();
        var ressource = t.$("form.addRessource input[type=file]").val();
        Meteor.call('addRessource', ressource, function(error, results) {
            console.log(results);
            return results;
        });
    },
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
        console.log(res);
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
    console.log(str);
    return str;
};

Template.enhancer.events({
    "click button[value=enhancerProcess]": function(event, t) {
        //TODO : REVOIR jQuery UI
        event.preventDefault();

        var dataToAnnotate = t.$("form.chooseEnhancerChain textarea[name=content]");
        dataToAnnotate = dataToAnnotate[0].value;
        console.log(dataToAnnotate);

        var uri = stanbolURL + "/enhancer/chain/all-active";

        $.ajax({
            type: "POST",
            url: uri,
            data: {query: query},
            accepts: ["application/json"],
                // dataType: "application/json",
            success: success,
            error: error
        });


        //var z = new VIE();
        //z.use(new z.StanbolService({
        //    url : stanbolURL,
        //    enhancer: {
        //        chain: t.$("form.chooseEnhancerChain select[name=chain]").val()
        //    }
        //}));

       // t.$('form.chooseEnhancerChain textarea[name=content]').annotate({
       //     vie: z,
       //     // typeFilter: ["http://dbpedia.org/ontology/Place", "http://dbpedia.org/ontology/Organisation", "http://dbpedia.org/ontology/Person"],
       //     debug: true,
       //     continuousChecking: true,
       //         //autoAnalyze: true,
       //     showTooltip: true,
       //     decline: function(event, ui){
       //         console.info('decline event', event, ui);
       //     },
       //     select: function(event, ui){
       //         console.info('select event', event, ui);
       //     },
       //     remove: function(event, ui){
       //         console.info('remove event', event, ui);
       //     },
       //     success: function(event, ui){
       //         console.info('success event', event, ui);
       //     },
       //     error: function(event, ui){
       //         console.info('error event', event, ui);
       //         alert(ui.message);
       //     }
       // });
    }
});


//Template.uploadRessource.events({
//    'click .start': function (e) {
//        Uploader.startUpload.call(Template.instance(), e);
//    }
//});
//
//Template.uploadRessource.created = function() {
//    Uploader.init(this);
//}
//
//Template.uploadRessource.rendered = function () {
//    Uploader.render.call(this);
//};
//
//Template.uploadRessource.helpers({
//    'infoLabel': function() {
//        var instance = Template.instance();
//
//        // we may have not yet selected a file
//        var info = instance.info.get()
//            if (!info) {
//                return;
//            }
//
//        var progress = instance.globalInfo.get();
//
//        // we display different result when running or not
//        return progress.running ?
//            info.name + ' - ' + progress.progress + '% - [' + progress.bitrate + ']' :
//            info.name + ' - ' + info.size + 'B';
//    },
//    'progress': function() {
//        return Template.instance().globalInfo.get().progress + '%';
//    }
//})
