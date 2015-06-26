var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost"; var couchDBPORT = 5984;
var dbRessource = "ressources";
var db = new(cradle.Connection)(couchDBURL, couchDBPORT).database(dbRessource);

var tempDirectoryToAnnotate = '../../../../../.uploads/toAnnotate/';

Meteor.methods({
    getListOnto: function() {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/getOntos");
    }, align2ontos: function(ont1, ont2, binary) {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/align/?ontology="+ont1+"&ontology="+ont2+"&binary="+binary);
    }, getMetaOnto: function(onto) {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/meta/?ontology="+onto);
    }, addOntology: function(onto, format) {
        this.unblock();
        // NO NEED : Client
    }, deleteOnto: function(onto) {
        this.unblock();
        return HTTP.call("DELETE", stanbolURL+"/ontonet/"+onto)
    }, getMetaRessource: function(ressourceID) {
        this.unblock();
    }, getListRessources: function() {
        this.unblock();
        var allDocs =  HTTP.call("GET", couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/_all_docs");

        var res = JSON.parse(allDocs.content);
        return res;
    }, fileUpload:function (filename, fileData) {
        var filePath = tempDirectoryToAnnotate + filename;
        console.log(filePath);
        fs.writeFile(filePath, new Buffer(fileData));
    }, getRessource: function(filename) {
        var res; // FIXME init
        db.get(filename, function (err, doc) {
            if (typeof doc != "undefined") {
                bool = true;
                res = { // FIXME Get author with view
                    id : doc._id,
                    rev : doc._rev,
                    doc : doc
                };
            }
        });
        return res;
    }, checkRessource: function(filename) {
        var res; //FIXME init
        var bool = false;
        db.get(filename, function (err, doc) {
            if (typeof doc != "undefined") {
                bool = true;
                res = { // FIXME Get author with view
                    checked: true,
                    id : doc._id,
                    rev : doc._rev
                };
            }
        });
        if (!bool)
            res = { checked: false };

        console.log("CHECK RESSOURCE");
        console.log(res);
        return res;
    }, addRessourceAnnotated: function(filename, author, extendedRessource, enhancement) {
        this.unblock();

        console.log("ADD RESSOURCE");
        db.save(filename, {
            filename: filename,
            author: author,
            enhancement : enhancement
        }, Meteor.bindEnvironment(function (err, res) {
            if (err) console.log(err);
            else console.log(res);

            var id = res.id;
            var rev = res.rev;

            console.log(filename);
            Meteor.call("addAttachment",
                    filename,
                    author,
                    rev,
                    id,
                    extendedRessource,
                    function(errors, results) {
//                        console.log("Document à modifier: " + filename + " rev: " + rev + " id:" + id);
//                        console.log("Auteur: " + author);
//                        console.log("HTML5 input file: " + extendedRessource);
//                        console.log("------------");
                    });
        }));
    }, addAttachment: function(filename, author, rev, id, ressource) {
        this.unblock();

        var doc = {
            _id: id,
            _rev: rev
        };
        var idData = {
            id: doc._id,
            rev: doc._rev
        };
        console.log("ADD ATTACHMENT");
        console.log(doc);
        console.log(ressource);

        var filePath = tempDirectoryToAnnotate + ressource.name;
        console.log("FILEPATH" + filePath);
        var readStream = fs.createReadStream(filePath);

        var attachmentData = {
            name: ressource.name,
            'Content-Type': ressource.type
        };
        var writeStream = db.saveAttachment(idData,
                attachmentData,
                function (err, reply) {
                    if (err) {
                        console.dir(err);
                        return;
                    }
                    console.dir(reply);
                });
        readStream.pipe(writeStream);
    }, getRevDocument: function(ressource) {
        return HTTP.call("HEAD",
                couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/"+ressource);
    }, deleteRessource: function(ressource) {
        this.unblock();

        var temp = Meteor.call('getRevDocument', ressource);
        var rev = temp.headers.etag.replace(/['"]+/g, '');
        return HTTP.call("DELETE",
                couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/"+ressource+"?rev="+rev);
    }, updateEnhancementAndRessource: function(settings, enhancement, extendedRessource) {
        this.unblock();
        db.save(settings.id, settings.rev,
                {   author: settings.author,
                    filename: settings.filename,
                    enhancement: enhancement },
                    Meteor.bindEnvironment(function (err, res) {
                        console.log(res);
                        Meteor.call("updateRessource",
                                settings.id,
                                res.rev,
                                settings.filename,
                                settings.author,
                                extendedRessource,
                                function(errors, results) {
                                    console.log("EOROJOOWJROJWEROJWOERJWE");
                                    console.log(errors);
                                    console.log(results);
                                }); //FIXME : check if same ressource
                    }));
    }, updateRessource: function(id, rev, filename, author, extendedRessource) {
        this.unblock(); // FIXME Delete existing ressource
        Meteor.call("addAttachment",
                filename,
                author,
                rev,
                id,
                extendedRessource,
                function(errors, results) { });
    }
});

//FIXME : may be not useful from now
Meteor.startup(function () {
    UploadServer.init({
        tmpDir:"../../../../../.uploads/tmp",
        uploadDir:"../../../../../.uploads/"
    })
});
