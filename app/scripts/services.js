angular.module('incredible.services', [])

.factory('nodeModService', function() {
  return {
    qiniu: require('qiniu'),
    fs: require('fs'),
    nedb: require('nedb'),
    'nw.gui': require('nw.gui')
  }
})


.factory('uploadService', function($rootScope, settingService, recordService) {
  var qiniu = require('qiniu'),
    fs = require('fs');

  function getUploadToken(bucketName) {
    var putPolicy = new qiniu.rs.PutPolicy(bucketName);
    return putPolicy.token();
  }

  function uploadFile(file, done) {
    settingService.get(function(err, setting) {
      var localFile = file.path,
        bucketName = setting.bucketName,
        extra = new qiniu.io.PutExtra(),
        token;
      qiniu.conf.ACCESS_KEY = setting.accessKey;
      qiniu.conf.SECRET_KEY = setting.secretKey;

      token = getUploadToken(bucketName);

      qiniu.io.putFile(token, file.key, localFile, extra, function(err, ret) {
        if(!err) {
          file.url = 'http://' + bucketName + '.qiniudn.com/' + ret.key;
          $rootScope.$broadcast('uploadService:fileUploaded', file);
          recordService.insert(file);
          if (done) {
            done(err, file);
          }
        } else {
          done(err);
        }
      });
    });
  }



  return {
    uploadFile: uploadFile
  };
})


.factory('dbService', function() {
  var DataStore = require('nedb'),
    db = {
      setting: new DataStore({ filename: 'data/setting.nedb', autoload: true }),
      record: new DataStore({ filename: 'data/record.nedb', autoload: true }),
      preset: new DataStore({ filename: 'data/preset.nedb', autoload: true })
    };

  return db;
})


.service('settingService', function(dbService) {
  var db = dbService.setting;
  this.get = function(done) {
    db.findOne({}, function(err, doc) {
      done(err, doc);
    });
  };
  this.save = function(setting, done) {
    db.remove({}, { multi: true }, function(err, numRemoved) {
      db.insert(setting, function(err, newDoc) {
        done(numRemoved);
      });
    });
  };
})


.service('recordService', function(dbService, $rootScope) {
  var db = dbService.record;
  this.getAll = function(done) {
    db.find({}).sort({ createdAt: -1 }).exec(done);
  };
  this.remove = function(doc, done) {
    done = done ? done : function() {};
    db.remove(doc, function(err, numRemoved) {
      $rootScope.$broadcast('recordService:recordsChanged');
      if (done) done(err, numRemoved);
    });
  };
  this.insert = function(doc, done) {
    delete doc.$$hashKey;
    done = done ? done : function() {};
    doc.createdAt = Date.now();
    db.insert(doc, function(err, doc) {
      $rootScope.$broadcast('recordService:recordsChanged');
      if(done) done(err, doc);
    });
  };
})


.service('presetService', function(dbService, $rootScope) {
  var db = dbService.preset;
  this.getAll = function(done) {
    db.find({}).sort({ createdAt: -1 }).exec(done);
  };
  this.remove = function(doc, done) {
    done = done ? done : function() {};
    db.remove({'_id':doc['_id']}, function(err, numRemoved) {
      $rootScope.$broadcast('presetService:presetsChanged');
      if (done) done(err, numRemoved);
    });
  };
  this.insert = function(doc, done) {
    delete doc.$$hashKey;
    done = done ? done : function() {};
    doc.createdAt = Date.now();
    db.insert(doc, function(err, doc) {
      $rootScope.$broadcast('presetService:presetsChanged');
      if(done) done(err, doc);
    });
  };
  this.update = function(doc, done) {
    db.update({'_id': doc['_id']}, doc, {}, function(err, numAffected) {
      $rootScope.$broadcast('presetService:presetsChanged');
      if (done) done(err, numAffected);
    });
  };
  this.save = function(doc, done) {
    if (doc["_id"]) {
      this.update(doc, done);
    }
    else {
      this.insert(doc, done);
    };
  };
  this.newInstance = function() {
    return {
      name: "",
      props: {
        h: 0,
        w: 0
      }
    };
  };
})


.service('presetUrlService', function() {
  this.getUrl = function(url, props) {
    return require('underscore').reduce(props, function(url, val, key) {
      return url + '/' + key + '/' + val;
    }, url + '?imageView2/1');
  };
});