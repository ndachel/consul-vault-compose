var Secret = function(name, secret, path) {
  var self = this;

  self.name = ko.observable(name);
  self.secret = ko.observable(secret);
  self.visible = ko.observable(false);

  self.id = ko.computed(function() {
    return path + '/' + self.name();
  });

  self.fieldType = ko.computed(function() {
    return self.visible() ? 'password' : 'text';
  });

  self.buttonText = ko.computed(function() {
    return self.visible() ? 'Show' : 'Hide';
  });

  self.toggleVisible = function() {
    self.visible(!self.visible());
  }
}

var SecretCollection = function(path, secrets) {
  var self = this;

  self.path = ko.observable(path);
  self.secrets = ko.observableArray();

  if (secrets) {
    Object.keys(secrets).forEach(function(key, index) {
      if (key !== 'lease_duration') {
        self.secrets.push(new Secret(key, secrets[key], path));
      }
    });
  }

  self.getSecretsAsObject = function() {
    var secrets = {};
    ko.utils.arrayForEach(self.secrets(), function(s) {
      secrets[s.name()] = s.secret();
    });
    return secrets;
  }

  self.edit = function() {
    var collection = new SecretCollection(path, self.getSecretsAsObject());
    page.secretForm().setupEdit(collection);
    page.secretForm().show();
  }

  self.save = function() {
    page.apiWrite(self.path(), self.getSecretsAsObject());
  }

  self.removeSecret = function(secret) {
    self.secrets.splice(self.secrets().indexOf(secret), 1);
  }

  self.deleteCollection = function() {
    page.apiDelete(self.path());
  }
}

var SecretForm = function() {
  var self = this;

  self.secretCollection = ko.observable();
  self.title = ko.observable();
  self.editMode = ko.observable();

  self.setupNew = function() {
    self.secretCollection(new SecretCollection('secret/'));
    self.addEmptySecret();
    self.title('Add New Secret');
    self.editMode(false);
  }

  self.setupEdit = function(collection) {
    self.secretCollection(collection);
    self.title('Edit Secret');
    self.editMode(true);
  }

  self.show = function() {
    $('#vaultAddModal').modal('show');
  }

  self.hide = function() {
    $('#vaultAddModal').modal('hide');
  }

  self.submit = function() {
    self.hide();
    self.secretCollection().save();
    self.setupNew();
  }

  self.deleteSecret = function() {
    if (confirm('Really delete ' + self.secretCollection().path() + ' ?')) {
      self.hide();
      self.secretCollection().deleteCollection();
      self.setupNew();
    }
  }

  self.addEmptySecret = function(collection) {
    self.secretCollection().secrets.push(new Secret('', ''));
  }

  self.setupNew();
}

var Page = function() {
  var self = this;

  self.endpoint = ko.observable(localStorage.vaultEndpoint);
  self.token = ko.observable(localStorage.vaultToken);
  self.secrets = ko.observableArray();
  self.secretForm = ko.observable(new SecretForm());
  self.vaultHealthResponse = ko.observable();
  self.vaultTokenResponse = ko.observable();
  self.vaultTokenDisplayName = ko.observable();

  self.endpoint.subscribe(function (text) {
    localStorage.vaultEndpoint = text;
  });

  self.token.subscribe(function (text) {
    localStorage.vaultToken = text;
  });

  self.logout = function() {
      //too destructive...
      //self.apiTokenRevoke();
      localStorage.vaultTokenResponse = "";
      localStorage.vaultToken = "";
      self.vaultTokenDisplayName("");
      self.token("");
      self.secrets([]);
  }

  self.sortByPath = function(left, right) {
    return left.path() > right.path() ? 1 : -1;
  }

  self.reloadAll = function() {
    self.secrets([]);
    self.apiList('secret/');
    self.getTokenDisplayName();
  }

  self.getHeaders = function() {
    return {'X-Vault-Token': self.token()};
  }

  self.getJsonHeaders = function() {
    var headers = self.getHeaders();
    headers['Content-Type'] = 'application/json';
    return headers;
  }

  self.getUrl = function(path) {
    return self.endpoint() + '/v1/' + path
  }

  self.apiHealth = function() {
    $.ajax({
      url: self.getUrl('sys/health'),
      success: self.apiHealthSuccess,
      error: onError
    });
  }

  self.apiToken = function() {
    $.ajax({
      url: self.getUrl('auth/token/lookup-self'),
      headers: self.getHeaders(),
      success: self.apiTokenSuccess,
      error: onError
    });
  }

  self.apiTokenRevoke = function() {
    $.ajax({
      url: self.getUrl('auth/token/revoke-self'),
      method: 'POST',
      headers: self.getHeaders(),
      success: self.apiTokenRevokeSuccess,
      error: onError
    });
  }

  self.getTokenDisplayName = function() {
    if (!self.vaultTokenDisplayName()) {
        self.apiToken();
    }
  }

  self.apiList = function(path) {
    $.ajax({
      url: self.getUrl(path),
      data: {'list': 'true'},
      headers: self.getHeaders(),
      success: self.apiListSuccess(path),
      error: onError
    });
  }

  self.apiRead = function(path) {
    $.ajax({
      url: self.getUrl(path),
      headers: self.getHeaders(),
      success: self.apiReadSuccess(path),
      error: onError
    });
  }

  self.apiWrite = function(path, data) {
    $.ajax({
      url: self.getUrl(path),
      data: toJson(data),
      method: 'POST',
      headers: self.getJsonHeaders(),
      success: self.reloadAll,
      error: onError
    });
  }

  self.apiDelete = function(path) {
    $.ajax({
      url: self.getUrl(path),
      method: 'DELETE',
      headers: self.getHeaders(),
      success: self.reloadAll,
      error: onError
    });
  }

  self.apiHealthSuccess = function(data) {
    self.vaultHealthResponse(toJson(data));
  }

  self.apiTokenSuccess = function(data) {
    self.vaultTokenResponse(toJson(data.data));
    var t = JSON.parse(self.vaultTokenResponse());
    var name = t.display_name;
    self.vaultTokenDisplayName(name);
  }

  self.apiTokenRevokeSuccess = function(data) {
    return true;
  }

  self.apiListSuccess = function(path) {
    return function(data) {
      var keys = data.data.keys;
      for (var key in keys) {
        var name = keys[key];
        if (name.endsWith('/')) {
          self.apiList(path + name);
        } else {
          self.apiRead(path + name);
        }
      }
    }
  }

  self.apiReadSuccess = function(path) {
    return function(data) {
      self.secrets.push(new SecretCollection(path, data.data));
    }
  }
}

var onError = function(response) {
  $('#errorModalBody').text(toJson(response));
  $('#errorModal').modal('show');
}

var toJson = function(object) {
  return JSON.stringify(object, null, 2)
}

var page = new Page();
ko.applyBindings(page);

if (page.endpoint() && page.token()) {
  page.reloadAll();
}
