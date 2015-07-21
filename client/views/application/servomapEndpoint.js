Meteor.call('getListOnto', function(error, results) {
    var ontologies = [];
    var tmp = JSON.parse(results.content);
    for (var cur in tmp) {
        ontologies.push(tmp[cur].uri);
    }
    Session.set('listOnto', ontologies);
    return ontologies;
});

function align(ont1, ont2, binary){ //TODO : binary OSGi : TODO
    Meteor.call('align2ontos', ont1, ont2, binary,
            function(error, results) {
                console.log(results.content);
                return results.content;
            });
}

function updateResultAvailable() {
    var ont1 = $('select[name=firstOnto]')[0];
    ont1 = ont1[ont1.selectedIndex].value;
    var ont2 = $('select[name=secondOnto]')[0];
    ont2 = ont2[ont2.selectedIndex].value;

    Meteor.call("getAlignmentsO1O2", ont1, ont2, function(err, results) {
        //FIXME need to be done at least 2 times at first to see anything.
        $('textarea[name=mappingResults]').val(results);

        //var fileArray = results.split('\n'); // TODO : Show alignments into a visualisation template via vivagraphjs or other.
        //And then let user edit via UI, then add them all into Marmotta/Triplestore
    });
}

Template.servomap.events({
    'click button[value=align]': function(event, t) {
        event.preventDefault();
        var ont1 = t.$('form.align2ontos select[name=firstOnto]')[0];
        ont1 = ont1[ont1.selectedIndex].value;
        var ont2 = t.$('form.align2ontos select[name=secondOnto]')[0];
        ont2 = ont2[ont2.selectedIndex].value;
        var referenceFile = t.$('form.align2ontos input[name=referenceFile]')[0]['files'][0];

        var binary = t.$('form.align2ontos input[name=binary]').val();

        if (typeof referenceFile != "undefined") {
            var reader = new FileReader();
            reader.onload = function(fileLoadEvent) {
                var settings = {
                    referenceFileBuffer: reader.result
                };
                Meteor.call('referenceFileFolder', ont1, ont2, settings,
                        function(err, results) {
                            align(ont1, ont2, binary);
                        });
            };
            reader.readAsBinaryString(referenceFile);
        } else {
            var settings = {
                //referenceFileBuffer: null
            };
            Meteor.call('referenceFileFolder', ont1, ont2, settings,
                        function(err, results) {
                            align(ont1, ont2, binary);
                        });
        }
    }, 'change select[name=firstOnto]': function(event, t) {
        event.preventDefault();
        updateResultAvailable();
    }, 'change select[name=secondOnto]': function (event, t) {
        event.preventDefault();
        updateResultAvailable();
    }
});

Template.servomap.helpers({
    "ontoSelectedDUM": function(){
        return Session.get('ontoSelected');
    }, "listOntos": function() {
        var str = Session.get('listOnto');
        console.log(str);
        return str;
    }, "MAPPING": function() {
        return Session.get("mappingsO1O2");
    }
});
