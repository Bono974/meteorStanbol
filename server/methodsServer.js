var stanbolURL = "http://localhost:8081";
var couchDBURL = "http://localhost";
var couchDBPORT = 5984;
var db = new(cradle.Connection)(couchDBURL, couchDBPORT).database('ressources');

Meteor.methods({
    getListOnto: function() {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/getOntos");
    },
    align2ontos: function(ont1, ont2, binary) {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/align/?ontology="+ont1+"&ontology="+ont2+"&binary="+binary);
    },
    getMetaOnto: function(onto) {
        this.unblock();
        return HTTP.call("GET", stanbolURL+"/servomap/meta/?ontology="+onto);
    },
    addOntology: function(onto, format) {
        this.unblock();
        // NO NEED : Client
    },
    deleteOnto: function(onto) {
        this.unblock();
        return HTTP.call("DELETE", stanbolURL+"/ontonet/"+onto)
    },

    getMetaRessource: function(ressource) {
        this.unblock();

        var url = stanbolURL+"/enhancer/chain/all-active";
        var filePath = '../../../../../.uploads/' + ressource;
        var fileStream = fs.createReadStream(filePath);
        var parts = {
            file: fileStream
        };

        var formData = MultipartFormData(parts);
        return HTTP.call(
                'POST',
                url,
                {
                    content: formData.content,
                    headers: formData.headers
                });
    },
    getListRessources: function() {
        this.unblock();
        var files = fs.readdirSync('../../../../../.uploads');
        //TODO : fetch all documents from Apache CouchDB
        var i = files.indexOf("tmp");
        if(i != -1)
            files.splice(i, 1);
        //TODO : remove all documents which start with 'enhanced_'
        return files.join();
    },
    fileUpload:function (filename, fileData) {
        var filePath = '../../../../../.uploads/' + filename;
        console.log(filePath);
        fs.writeFile(filePath, fileData);
    },
    checkRessource: function(filename, author) {
        var res;
        var bool = false;
        db.get(filename, function (err, doc) {
            bool = true;
            res = {
                checked: true,
                author : doc.author,
                rev : doc.rev,
                id : doc.id
            };
        });
        if (!bool) {
            res = { checked: false };
        }
        console.log("CHECK RESSOURCE");
        console.log(res);
        return res;
    },
    addRessource: function(filename, author) {
        this.unblock();

        var revT = "revTemp";
        db.save(filename, {
            filename: filename,
            author: author
        }, function (err, res) {
            if (err)
                console.log(err);
            else {
                revT = { rev: res.rev }
            }
        });
        return revT;
    },
    addAttachment: function(filename, author, rev, id, ressource) {
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

        var filePath = '../../../../../.uploads/' + ressource.name;
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
        readStream.pipe(writeStream)
    },
    deleteRessource: function(ressource) {
        this.unblock();
        var filePath = '../../../../../.uploads/' + ressource;
        fs.unlinkSync(filePath);
        return ressource + " DELETED";
    },
    getListChains: function() {
        // NO NEED : client side
        return 'toto, toto, toto';
    }
});

Meteor.startup(function () {
  UploadServer.init({
    tmpDir:"../../../../../.uploads/tmp",
    uploadDir:"../../../../../.uploads/"
  })
});
