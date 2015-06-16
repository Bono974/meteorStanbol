Meteor.methods({
    getListOnto: function() {
        this.unblock();
        return HTTP.call("GET", "http://localhost:8080/servomap/getOntos");
    },
    align2ontos: function(ont1, ont2, binary) {
        this.unblock();
        return HTTP.call("GET", "http://localhost:8080/servomap/align/?ontology="+ont1+"&ontology="+ont2+"&binary="+binary);
    },
    getMetaOnto: function(onto) {
        this.unblock();
        return HTTP.call("GET", "http://localhost:8080/servomap/meta/?ontology="+onto);
    },
    addOntology: function(onto, format) {
        this.unblock();
        var onto1 = "P:\\ontologies\\mouse.owl";
        return HTTP.call("POST", "http://localhost:8080/servomap/add/",
        {
            headers: {
                "Content-type": "application/json"
            },
            params: {
                file: onto,
                format: format

            }
        });
    },
    deleteOnto: function(onto) {
        this.unblock();
        return HTTP.call("DELETE", "http://localhost:8080/ontonet/"+onto)
    },

    getMetaRessource: function(ressource) {
        this.unblock();

        var url = "http://localhost:8080/enhancer/chain/all-active";
        var filePath = '../../../../../.uploads/' + ressource;
        //var enhancedPath = '../../../../../.uploads/' + 'enhanced_'+ ressource;
        //var destination = fs.createWriteStream(enhancedPath);
        //var settings = {
        //    encoding: null,
        //    method: 'POST',
        //    url: url
        //};
        //var req = request(settings).pipe(destination);

        //file.pipe(req);

        //console.log(req.body);


        //var fileStream = fs.createReadStream(filePath);

        var parts = {
            file: filePath
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
    addRessource: function(ressource) {
        this.unblock();
        return "RESSOURCE ADDED";
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
