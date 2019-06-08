# Haplo Research Manager                            https://haplo.org
# (c) Haplo Services Ltd 2006 - 2019           https://www.haplo.com
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# See the README.txt file for how to use this script.

module EPrintsImportInformation
  extend KObjectURLs

  APPLICATION_ID = 473629

  OUTPUT_FILE = "#{File.dirname(KFRAMEWORK_LOG_FILE)}/app#{APPLICATION_ID}-eprints-mapping-info.json"

  def self.run
    KApp.in_application(APPLICATION_ID) { run2 }
  end

  def self.run2
    outputs = []
    db = KApp.get_pg_database
    sql = "SELECT _object, eprintid FROM #{plugin_db_table_name('hres_repo_eprints', 'eprintsmetadata')} ORDER BY _object"
    results = db.exec(sql)
    puts "  count: #{results.length}"
    results.each do |ref_s,eprintsid|
      objref = KObjRef.new(ref_s.to_i)
      output = KObjectStore.read(objref)
      files = []
      output.each do |v,d,q|
        if v.kind_of?(KIdentifierFile)
          i = {
            digest: v.digest,
            size: v.size,
            filename: v.presentation_filename
          }
          stored_file = StoredFile.from_identifier(v)
          disk_pathname = stored_file.disk_pathname
          if File.exist? disk_pathname
            i["md5"] = Digest::MD5.file(disk_pathname).hexdigest
          end
          files.push i
        end
      end
      outputs.push({
        eprintsid: eprintsid,
        ref: objref.to_presentation,
        url: object_urlpath(output),
        title: output.first_attr(KConstants::A_TITLE).to_s,
        files: files
      })
    end

    config_data = JSON.parse(KApp.global(:javascript_config_data) || '{}')

    File.open(OUTPUT_FILE,"wb") { |f| f.write JSON.pretty_generate({
      "applicationId" => APPLICATION_ID,
      "hostname" => KApp.global(:ssl_hostname),
      "publications" => get_publication_hostnames(),
      "shortItemUrls" => config_data["repo_standard_publication:use_short_item_urls"],
      "outputs" => outputs
    }) }

    puts "EPrints mapping information saved to #{OUTPUT_FILE}"
    puts "Download this file and use with the eprints-generate-redirects-and-mappings.rb script."
  end

  def self.plugin_db_table_name(plugin_name, table_name)
    db_namespace = KJSPluginRuntime::DatabaseNamespaces.new()[plugin_name]
    "j_#{db_namespace}_#{table_name.downcase}"
  end

  def self.get_publication_hostnames
    runtime = KJSPluginRuntime.current
    runtime.using_runtime do
      web_publisher = runtime.runtime.host.getWebPublisher()
      publication_json = web_publisher.callPublisher("$getPublicationHostnames").to_s
      JSON.parse(publication_json)
    end
  end

end

EPrintsImportInformation.run
