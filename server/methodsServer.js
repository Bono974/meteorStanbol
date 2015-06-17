var stanbolURL = "http://localhost:8081";
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

        var FormData = Meteor.npmRequire('form-data');
        //var form = new FormData({
        //    version: "1.0.0-rc1"
        //});

        var form = new FormData();

        //var filePath = '../../../../../.uploads/' + onto;
        var filePath = '../../../../../.uploads/atc.owl';
        //form.append('file', filePath);
        form.append('format', format);
        form.append('file', fs.readFile(filePath));
        var url = stanbolURL+"/servomap/add/";

        //console.log(form);
        return HTTP.call(
                'POST',
                url,
                {
                    content: form.content,
                    headers: form.headers
                });
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
