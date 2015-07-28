var stanbolURL = "http://localhost:8081";
var marmottaURL = "http://localhost:8080/marmotta";
var fusekiURL = "http://localhost:3030/testHDTFuseki/query";
var couchDBURL = "http://localhost"; var couchDBPORT = 5984;
var dbRessource = "ressources";

//var referenceMeteorStanbol = "D:/users/bt1/referenceMeteorStanbol"; //Windows at work
var referenceMeteorStanbol = "/Users/bruno/referenceMeteorStanbol"; // OSX at home

var db = new(cradle.Connection)(couchDBURL, couchDBPORT).database(dbRessource);

var tempDirectoryToAnnotate = '../../../../../.uploads/toAnnotate/';

var ressourceStore = new FS.Store.FileSystem("ressources", {
  path: tempDirectoryToAnnotate
});

//var hdtFilePath = "D:/users/bt1/referenceMeteorStanbol/marmottaRepository/repo.hdt"; //Windows at work
//var hdtFilePath = "/Users/bruno/referenceMeteorStanbol/marmottaRepository/repo.hdt"; //OSX at home
var hdtFilePath = "/Users/bruno/export.hdt"; //OSX at home


var graphRDFMapping = "http://alignmentsGraph";
var graphRDFAnnotation = "http://localhost:8080/marmotta/context/alignementsTests"
var typeRessourceAnnotated = graphRDFAnnotation + "#ressourceAnnotated";
var PREFIX = "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"; //TODO add more prefixes

function generateUID(separator) {
    var delim = separator || "-";
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
}

function normaliseURItoFolderName(ont) {
    var res = ont.replace(/:/g, '');
    res = res.replace(/\//g, '~');

    return res;
}

function createFolderReference(folderName) {
    mkdirp(folderName, function (err) {
        if (err) console.error(err)
        //else console.log('pow!')
    });
}

function createFilesFolderReference(filePath, defined) { // ServOMap requirements (with no reference file)
    fs.open(filePath+".txt", 'w', function (err, fd) {
        fs.close(fd);
        if (!defined)
            fs.open(filePath+".rdf", 'w', function (err, fd) {
                fs.close(fd);
            });
    });
}

function uploadFileRef(filePath, fileData) { // ServOMap requirements (with reference file)
    fs.writeFile(filePath+".rdf", new Buffer(fileData));
}

function findTripleFromDoc(subject, predicate, graph, doc) {
    var docObj = JSON.parse(doc);
    var enhancement = docObj.enhancement;
    var strGraph = "@graph";
    var strID = "@id";
    var strEnhancerEntityReference = "enhancer:entity-reference";
    var strEntityReference = "entity-reference";

    var enhancementGraph = docObj.enhancement[strGraph];
    var res = "";

    for (var cur in enhancementGraph) { // FIXME : undefined...
        var tmp = enhancementGraph[cur][strEntityReference];
        if (typeof(tmp) != "undefined")
            res += subject + " " + predicate + " <" + enhancementGraph[cur][strEntityReference] + "> . ";
        else
            res += subject + " " + predicate + " <" + enhancementGraph[cur][strEnhancerEntityReference] + "> . ";
    }

    // Add attachment name as a triplet as well : Must be size 1, if not : retrieve for now the first attachment
    // FIXME : WARNING /!\ : UTF8 characters are not supported for the moment : to be verified
    var attachment = Object.keys(docObj["_attachments"]);

    // Suppose the repository / final query has a PREFIX for rdfs:<Thing>
    var predicateRdfsLabel = "rdfs:label";
    var predicateRdfsType = "rdfs:type";
    var attachmentTriple =  subject + " " + predicateRdfsLabel + " \"" + attachment + "\"@fr .";

    console.log(attachmentTriple);

    var typeRessource = subject + " " + predicateRdfsType + "<" + typeRessourceAnnotated + ">";

    return {
        res: res,
        attachmentTriple: attachmentTriple,
        typeRessource: typeRessource
    };
}

function getURLRessourceCouchDBFromEntity(entity, ressourceNonAnnotated) {
    // FIXME : need to be more tested
    // Consider all ressource triples begin with a #
    var positionHashtag = entity.indexOf('#');
    var tmp = entity.substring(positionHashtag+1, entity.length);
    tmp = tmp.split('_');

    return couchDBURL + ":" + couchDBPORT + "/" + dbRessource + "/" + tmp[0] + "/" + ressourceNonAnnotated + "?rev=" + tmp[1];
}

Meteor.methods({
    getListOnto: function() {
        this.unblock();
        return HTTP.call("GET", marmottaURL+"/context/list?labels");
    }, referenceFileFolder: function(ont1, ont2, settings) {
        this.unblock();

        var uriFolder1 = normaliseURItoFolderName(ont1);
        var uriFolder2 = normaliseURItoFolderName(ont2);

        var folderTest1 = referenceMeteorStanbol + "/" + uriFolder1 + "_" + uriFolder2;
        var folderTest2 = referenceMeteorStanbol + "/" + uriFolder2 + "_" + uriFolder1;

        var res = {};

        // reference without extension : let uploadFileRef do it
        var res = Async.runSync(function (done) {
            fs.stat(folderTest1+"/reference.rdf", function(err, stat) {
                if(err == null) {
                    res = {
                        folder : folderTest1,
                        existed : true
                    };
                    if (typeof settings.referenceFileBuffer != "undefined")
                        uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                    done(null, res);
                } else if(err.code == 'ENOENT') {
                    fs.stat(folderTest2+"/reference.rdf", function(err, stat) {
                        if (err == null) {
                            res = {
                                folder : folderTest2,
                                existed : true
                            };
                            if (typeof settings.referenceFileBuffer != "undefined")
                                uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                            done(null, res);
                        } else if (err.code == 'ENOENT') {
                            res = {
                                folder : folderTest1,
                                existed : false
                            };
                            createFolderReference(folderTest1);

                            if (typeof settings.referenceFileBuffer != "undefined") {
                                createFilesFolderReference(folderTest1+"/reference", true);
                                uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                            } else
                                createFilesFolderReference(folderTest1+"/reference", false);
                            done(null, res);
                        } else {
                            console.log('Some other error: ', err.code);
                            res = {
                                err : err.code
                            };
                            done(null, res);
                        }
                    });
                } else {
                    console.log('Some other error: ', err.code);
                    res = {
                        err : err.code
                    };
                    done(null, res);
                }
            }
        )});
        return res;
    }, align2ontos: function(ont1, ont2, binary) {
        this.unblock();
        var onto1 = marmottaURL+"/export/download?context="+ont1+"&format=application%2Frdf%2Bxml";
        var onto2 = marmottaURL+"/export/download?context="+ont2+"&format=application%2Frdf%2Bxml";
        return HTTP.call("GET", stanbolURL+"/servomap/align/?ontology="+onto1+"&ontology="+onto2+"&binary="+binary);
    }, getAlignmentsO1O2: function(ont1, ont2, bool) {
        this.unblock();
        var res = Async.runSync(
                function(done) {
                    var settings = {
                        //referenceFileBuffer: null
                    };
                    Meteor.call("referenceFileFolder", ont1, ont2, settings, function(err, results) {
                        var res = "NULL";
                        if (results.result.existed) {
                            res = results.result.folder;
                            console.log(res);
                            fs.stat(res+"/result.txt", function(err, stat) {
                                if (err == null)
                                    done(null, res+"/result.txt"); // Mapping exist -> show to client (string/JSON to visu)
                                else
                                    done(null, err.code);
                            });
                        }
                        else if (results.result.err) {
                            res = "ERROR 504";
                            done(null, res);
                        }
                    });
                });

        if (typeof(bool) != "undefined") // --> See putAlignmentsO1O2
            return res.result;

        if (res.result.search("result.txt") == -1)
            return "Erreur !";
        else {
            var resS = Async.runSync(
                    function(done) {
                        fs.readFile(res.result, 'utf-8', function(err, data) {
                            done(null, data);
                        });
                    });
            return resS.result;
        }
    }, putAlignmentsO1O2: function(ont1, ont2, settings){
        // put full result.txt into Marmotta
        // FIXME TODO : choose a good name for ont1/ont2 contexts
        this.unblock();

            console.log("TEST 1");
        Meteor.call('getAlignmentsO1O2', ont1, ont2, true, function(err, results) {
            console.log(results);
            if (results.search("result.txt") == -1) // No result file
                return;

            console.log("TEST 2");
            var graph = graphRDFMapping;
            var author = settings.author;
            var tool = settings.tool; // ServOMap / LogMap / Manual
            var authorID = author; // For now ?
            var onto1ID = "<" + ont1 + ">"; // For now ?
            var onto2ID = "<" + ont2 + ">"; // For now ?
            var onto1URI = ont1;
            var onto2URI = ont2;
            var alignmentID = "alignment_" + ont1 + "_" + ont2;
            var alignmentURI = "<" + graph + "#" + alignmentID + ">";
            var authorURI = "<" + graph + "#" + authorID + ">";
            var query1 =
                "PREFIX align:<" + graph + "#> "+
                " INSERT DATA {" +
                "	GRAPH <" + graph + "> {" +
                "		" + authorURI + " rdfs:subClassOf align:Agent ." +
                "		" + authorURI + " rdfs:label \""+ author + "\" . " +
                "		" + alignmentURI + " rdfs:subClassOf align:Alignment ." +
                "		" + alignmentURI + " align:has_author " + authorURI + " ." +
                "		" + alignmentURI + " align:has_tool align:" + tool + " . " +
                "		" + onto1ID + " rdfs:subClassOf align:Ontology ." +
                "		" + onto2ID + " rdfs:subClassOf align:Ontology ." +
                "		" + onto1ID + " align:has_location \"" + onto1URI + "\" . " +
                "		" + onto2ID + " align:has_location \"" + onto2URI + "\" . " +
                "		" + onto1ID + " align:has_alignment "+ alignmentURI + " .";
                "		" + onto2ID + " align:has_alignment "+ alignmentURI + " .";
                "	}" +
                "}";

            var resultFile = results;
            var res = Async.runSync(
                    function(done) {
                        fs.readFile(resultFile, 'utf-8', function(err,data) {
                            var triples = "";
                            var fileArray = data.split('\n');
                            for (var cur in fileArray) {
                                var currentMapping = fileArray[cur].split(';');

                                var e1 = currentMapping[0];
                                var e2 = currentMapping[1];

                                if (e1 === "" || e2 === "")
                                    continue;

                                var relation = " align:Equivalent "; //for now : "align:Equivalent"
                                var measure = currentMapping[2];

                                var mappingID = generateUID(); //e1 + e2;

                                e1 = "<" + e1 + ">";
                                e2 = "<" + e2 + ">";

                                var uriMappingID = "<" + graph + "#" + mappingID + ">";
                                var uriAlignmentID = "<" + graph + "#" + alignmentID + ">";

                                triples += uriAlignmentID   + " align:has_mapping "     + uriMappingID + " . ";
                                triples += uriMappingID     + " rdfs:subClassOf "       + " align:Mapping . ";
                                triples += uriMappingID     + " align:has_entity1 "     + e1 + " . ";
                                triples += uriMappingID     + " align:has_entity2 "     + e2 + " . ";
                                triples += uriMappingID     + " align:has_relation "    + relation + " . ";
                                triples += uriMappingID     + " align:has_measure \""   + measure + "\" . ";
                            }
                            done(null, triples);
                        })
                    });
            var triples = res.result;
            console.log(triples);

            var query2 =
                "PREFIX align:<" + graph + "#> " +
                " INSERT DATA {" +
                "   GRAPH <" + graph + ">" +
                "   {" +
                        triples +
                "   }" +
                "}";

            //console.log(query2);
            Meteor.call('queryUpdateMarmotta', query1, function(err, results) {
                if (err) console.log(err);
                else
                    Meteor.call('queryUpdateMarmotta', query2, function(err, results) {
                        if (err) console.log(err);
                    });
            });
        });
    }, querySelectMarmotta: function(queryS){
        var endpoint = marmottaURL+'/sparql/select';
        var res = Async.runSync(
                function(done) {
                    Meteor.call('query', endpoint, queryS, function(err, results) {
                        //console.log(results);
                        done(null, results);
                    })
                });
        return res.result;
    }, queryUpdateMarmotta: function(queryU) {
        var endpoint = marmottaURL+'/sparql/update';
        Meteor.call('query', endpoint, queryU);
    }, querySelectFuseki: function(queryS) {
        var endpoint = fusekiURL;
        var res = Async.runSync(
                function(done) {
                    Meteor.call('query', endpoint, queryS, function(err, results) {
                        //console.log(results);
                        done(null, results);
                    })
                });
        return res.result;
    }, query: function(endpoint, query) {
        //var query = "SELECT * FROM <http://human.owl> WHERE {?s rdfs:subClassOf ?o} LIMIT 10";
        var sparql = Meteor.npmRequire('sparql-client');
        var util = Meteor.npmRequire('util');

        var client = new sparql(endpoint);
        var result = Async.runSync(
                function(done) {
                    client.query(query).execute(function(error, results) { //FIXME : When query is not valid --> error
                        //process.stdout.write(util.inspect(arguments, null, 20, true)+"\n");1
                        done(null, results);
                    });
                });
        return result.result;
    }, getMetaOnto: function(onto) {
        this.unblock();
        var marmottaExportOntology = marmottaURL+"/export/download?context="+onto+"&format=application%2Frdf%2Bxml";
        return HTTP.call("GET", stanbolURL+"/servomap/meta/?ontology="+marmottaExportOntology);
    }, addEnhancementsToRepo: function(filename) {
        var query = Async.runSync(
                function(done) {
                    db.get(filename, function (err, doc) { //Doc here exist
                        var graph = graphRDFAnnotation;
                        var subject = "<" + graph + "#" + doc._id + '_' + doc._rev + ">"; // FIXME : temporary ?
                        var predicate = "<" + graph + "#annotePar>";
                        var triples = findTripleFromDoc(subject, predicate, graph, doc);
                        //FIXME : PREFIX(es) must be a global variable
                        var queryEnhancements = PREFIX +
                        "INSERT DATA  " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.res +
                        "    }"+
                        "}";
                        var queryAttachment = PREFIX +
                        "INSERT DATA " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.attachmentTriple +
                        "    }"+
                        "}";
                        var queryType = PREFIX +
                        "INSERT DATA " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.typeRessource +
                        "    }"+
                        "}";

                        var res = {
                            queryEnhancements: queryEnhancements,
                            queryAttachment: queryAttachment,
                            queryType: queryType
                        };
                        done(null, res);
                    })
                });
        Meteor.call('queryUpdateMarmotta', query.result.queryEnhancements, function(err, results) {
            if (err) console.log(err);
            else {
                Meteor.call('queryUpdateMarmotta', query.result.queryAttachment, function(err, results) {
                    if (err) console.log(err);
                    else {
                        Meteor.call('queryUpdateMarmotta', query.result.queryType, function(err, results) {
                            if (err) console.log(err);
                        });
                    }
                });
            }
        });
    }, testIfRessourceFromRepo: function(entity) {
        this.unblock();

        var queryType = PREFIX +
                        "SELECT *"+
                        "WHERE {"+
                            "<" + entity + "> rdfs:type ?object"+
                        "}";
        var queryLabel = PREFIX +
                        "SELECT *"+
                        "WHERE {"+
                            "<" + entity + "> rdfs:label ?object"+
                        "}";
        var res = Async.runSync(
                function(done) {
                    Meteor.call('querySelectMarmotta', queryType, function(err, results) {
                        var res = results.results.bindings;
                        if (typeof(res[0]) != "undefined")
                            if (typeof(res[0].object) != "undefined")
                                if (res[0].object.value === typeRessourceAnnotated) {

                                    Meteor.call('querySelectMarmotta', queryLabel, function(err, results) {
                                        var res = results.results.bindings;
                                        var ressourceNonAnnotated = res[0].object.value;
                                        var urlRessource = getURLRessourceCouchDBFromEntity(entity, ressourceNonAnnotated);

                                        done(null, urlRessource);
                                        return;
                                    });
                                    return;
                                }
                        done(null, "N'est pas une ressource");
                    });
                });
        return res.result;
    }, addOntology: function(onto, format) {
        this.unblock();
        // NO NEED : Client
    }, deleteOnto: function(onto) {
        this.unblock();
        return HTTP.call("DELETE", marmottaURL+"/context/?graph="+onto)
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
        var res; // FIXME init with MEteor npm package async
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
    }, callAsyncQueryHDTFile: function (subject, predicate, object, offset, limit) {
        this.unblock();
        var hdt = Meteor.npmRequire('hdt');

        var res = Async.runSync(
                function(done) {
                    hdt.fromFile(hdtFilePath, function(error, hdtDocument) {
                        console.log(error);
                        hdtDocument.searchTriples(subject, predicate, object, {offset:0, limit:limit},
                            function(error, triples, totalCount){
                                //console.log(triples);
                                //triples.forEach(function(triple) {
                                //    console.log(triple);
                                //});
                                hdtDocument.close();
                                done(null, triples);
                            });
                    })
                });
        return res.result;
    }, callAsyncQueryIndividualHDTFile: function (pattern, offset, limit) {
        this.unblock();
        var hdt = Meteor.npmRequire('hdt');

        var res = Async.runSync(
                function(done) {
                    hdt.fromFile(hdtFilePath, function(error, hdtDocument) {
                        console.log(error);
                        hdtDocument.searchLiterals(pattern, {offset:offset, limit:limit},
                            function(error, literals, totalCount){
                                console.log(error);
                                console.log(literals);
                                hdtDocument.close();
                                done(null, literals);
                            });
                    })
                });
        return res.result;
    }
});

//FIXME : may be not useful from now
Meteor.startup(function () {
    UploadServer.init({
        tmpDir:"../../../../../.uploads/tmp",
        uploadDir:"../../../../../.uploads/"
    })
});

//QueryResult = new Mongo.Collection("resultHDT");
//QueryResult.remove({});
//QueryResult.allow({
//    insert: function(){return true;}
//});

