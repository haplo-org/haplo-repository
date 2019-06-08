# Haplo Research Manager                            https://haplo.org
# (c) Haplo Services Ltd 2006 - 2019           https://www.haplo.com
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

require 'java'
require 'json'
require 'erb'
require 'uri'
require 'rubygems'
gem 'builder'
require 'builder'

HAPLO_INFO = ARGV[0]
EPRINTS_INFO = ARGV[1]
OLD_URL = ARGV[2]
raise "Must provide Haplo information file as first argument" unless HAPLO_INFO && File.exist?(HAPLO_INFO)
raise "Must provide EPrints export XMl as second argument" unless EPRINTS_INFO && File.exist?(EPRINTS_INFO)
raise "Must provide URL of old repository as third argument" unless OLD_URL && OLD_URL =~ /\Ahttps?:\/\//

# Read info about objects in Haplo

eprintsid_to_haplo_object = {}
haplo_info = JSON.parse(File.read(HAPLO_INFO))
raise "Bad Haplo info" unless haplo_info["applicationId"] && haplo_info["hostname"]
haplo_info["outputs"].each do |object|
  eprintsid_to_haplo_object[object['eprintsid']] = object
end

SHORT_ITEM_URLS = haplo_info["shortItemUrls"]

# Read the EPrints XML to get info about all objects

eprints_info = []

eprints_xml = javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(java.io.File.new(EPRINTS_INFO))
list = eprints_xml.getElementsByTagName('eprint')
for index in 0...list.getLength()
  eprint = list.item(index)
  children = eprint.getChildNodes()
  eprintid = nil
  deleted = false
  files = []
  for c in 0...children.getLength()
    node = children.item(c)
    name = node.getNodeName()
    case name
    when 'eprintid'
      eprintid = node.getTextContent().strip
    when 'eprint_status'
      deleted = true if node.getTextContent().strip != 'archive'
    when 'documents'
      docs = node.getChildNodes()
      for d in 0...docs.getLength()
        document = docs.item(d)
        document_c = document.getChildNodes()
        for df in 0...document_c.getLength()
          f = document_c.item(df)
          if f.getNodeName() == 'files'
            file_c = f.getChildNodes()
            file_attr = {}
            for ff in 0...file_c.getLength()
              fa = file_c.item(ff)
              if fa.getNodeName() == 'file'
                faac = fa.getChildNodes()
                for faaca in 0...faac.getLength()
                  faa = faac.item(faaca)
                  file_attr[faa.getNodeName()] = faa.getTextContent().strip
                end
              end
            end
            files.push(file_attr)
          end
        end
      end
    end
  end
  unless deleted
    eprints_info.push({
      "eprintid" => eprintid,
      "files" => files
    })
  end
end

# Generate the redirects

redirects = []
warnings = []

eprints_info.each do |info|
  eprintid = info["eprintid"]
  files = info["files"]

  haplo_object = eprintsid_to_haplo_object[eprintid]

  unless haplo_object
    warnings << "EPrints ID #{eprintid}: Doesn't have Haplo object"
  else
    haplo_object_url_path = "/item/"+haplo_object["ref"]
    unless SHORT_ITEM_URLS
      # match slug algorithm from web publisher (different to platform)
      slug = haplo_object["title"].downcase.gsub(/[^a-z0-9]+/,'-')
      if slug.length > 200
        slug = slug[0..200].sub(/-[a-z0-9]+?\z/,'')
      end
      slug.gsub!(/-\z/,'')
      haplo_object_url_path += "/"+slug
    end
    redirects << "/#{eprintid}\t#{haplo_object_url_path};"
    redirects << "/#{eprintid}/\t#{haplo_object_url_path};"
    redirects << "/id/eprint/#{eprintid}\t#{haplo_object_url_path};"

    files.each do |file|
      eprints_file_path = file['url'].gsub(OLD_URL,'')
      raise "scheme and host weren't removed -- have you supplied the correct old URL?" if eprints_file_path =~ /https?:/
      haplo_files = haplo_object['files']
      hf = nil
      if file['hash_type'] == 'MD5'
        hf = haplo_files.find { |f| f['md5'] == file['hash'] }
      end
      unless hf
        # fall back to filename
        hf = haplo_files.find { |f| f['filename'] == file['filename'] }
        if hf
          if file['hash']
            warnings << "EPrints ID #{eprintid}: fell back to filename matching with Haplo file for: #{file['filename']} (digest didn't match)"
          else
            warnings << "EPrints ID #{eprintid}: fell back to filename matching with Haplo file for: #{file['filename']} (EPrints didn't include a digest)"
          end
        end
      end
      if hf
        redirects << "#{eprints_file_path}\t/download/#{hf['digest']}/#{hf['size']}/#{ERB::Util.url_encode(hf['filename'])};"
        if hf['filename'] =~ /\%/
          warnings << "EPrints ID #{eprintid} finds Haplo file with % in filename: #{hf['filename']}"
        end
      end
      unless hf
        warnings << "EPrints ID #{eprintid}: can't find Haplo file for: #{file['filename']}"
      end
    end
  end
end

File.open("app#{haplo_info["applicationId"]}-redirects.txt", "w") do |r|
  redirects.each do |rdr|
    r.puts rdr
  end
end

haplo_hostname = haplo_info["publications"].first || haplo_info["hostname"]
eprints_hostname = URI(OLD_URL).hostname
File.open("app#{haplo_info["applicationId"]}-oai-pmh-mapping.tsv", "w") do |m|
  haplo_info["outputs"].each do |object|
    if object['eprintsid']
      m.puts "oai:#{eprints_hostname}:#{object['eprintsid']}\toai:#{haplo_hostname}:#{object['ref']}"
    end
  end
end

SITEMAPS = [
  [OLD_URL, "app#{haplo_info["applicationId"]}-sitemap.old.xml", 0, /\A\/(id\/eprint\/)?\d+\z/],
  ['https://'+haplo_info["hostname"], "app#{haplo_info["applicationId"]}-sitemap.new.xml", 1]
]

SITEMAPS.each do |url,filename,path_index,exclude|
  builder = Builder::XmlMarkup.new({:indent=>2})
  builder.instruct!
  builder.urlset({"xmlns"=>"http://www.sitemaps.org/schemas/sitemap/0.9"}) do |urlset|

    seen_path = {}
    redirects.each do |line|
      paths = line.chomp.sub(/;\z/,'').split(/\t/)
      path = paths[path_index]
      unless seen_path[path] || (exclude && path =~ exclude)
        urlset.url do |u|
          u.loc(url+path)
        end
        seen_path[path] = true
      end
    end

  end

  File.open(filename,"w") { |f| f.write builder.target! }
end


warnings.each do |warning|
  STDERR.puts warning
end
STDERR.puts "#{warnings.length} warnings"
