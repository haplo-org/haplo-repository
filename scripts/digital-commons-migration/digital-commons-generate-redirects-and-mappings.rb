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
DC_INFO = ARGV[1]
OLD_HOSTNAME = ARGV[2]
raise "Must provide Haplo information file as first argument" unless HAPLO_INFO && File.exist?(HAPLO_INFO)
raise "Must provide Digital Commons JSON file as second argument" unless DC_INFO && File.exist?(DC_INFO)
raise "Must provide URL of old repository as third argument" unless OLD_HOSTNAME

# Both schemes are used in the metadata
OLD_URL_HTTP = 'http://'+OLD_HOSTNAME
OLD_URL_HTTPS = 'https://'+OLD_HOSTNAME

# Read info about objects in Haplo

dc_url_to_haplo_object = {}
haplo_info = JSON.parse(File.read(HAPLO_INFO))
raise "Bad Haplo info" unless haplo_info["applicationId"] && haplo_info["hostname"]
haplo_info["outputs"].each do |object|
  dc_url_to_haplo_object[object['dcUrl']] = object
end

SHORT_ITEM_URLS = haplo_info["shortItemUrls"]

digital_commons_info = []

dc_json = JSON.parse(File.read(DC_INFO))
dc_json.each do |digital_commons|
  files = [];
  # fulltext_url is always present, but 404s unless there is actually a file
  # download_link is only present if a file exists, so check for presence of that first, and whether it points
  #  to the legacy repository system
  if digital_commons['download_link'] && digital_commons['download_link'].include?(OLD_HOSTNAME)
    ['download_link', 'fulltext_url'].each do |f|
      file = digital_commons[f]
      files.push(file) if file && file.include?(OLD_HOSTNAME)
    end
  end
  digital_commons_info.push({
    "files" => files,
    "fulltext_url" => digital_commons['fulltext_url'],
    "url" => digital_commons['url']
  })
end

# Generate the redirects

redirects = []
warnings = []

digital_commons_info.each do |info|
  url = info["url"]
  files = info["files"]

  haplo_object = dc_url_to_haplo_object[url]

  unless haplo_object
    warnings << "DC URL #{url}: Doesn't have Haplo object"
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
    relative_path = url.gsub(OLD_URL_HTTPS, "").gsub(OLD_URL_HTTP, "")
    redirects << "#{relative_path}\t#{haplo_object_url_path};"
    redirects << "#{relative_path}/\t#{haplo_object_url_path};"

    files.each do |file|
      dc_file_path = file.gsub(OLD_URL_HTTPS, '').gsub(OLD_URL_HTTP, '')
      raise "scheme and host weren't removed -- have you supplied the correct old URL?" if dc_file_path =~ /https?:/
      haplo_files = haplo_object['files']
      hf = haplo_files[0]
      if hf
        redirects << "#{dc_file_path}\t/download/#{hf['digest']}/#{hf['size']}/#{ERB::Util.url_encode(hf['filename'])};"
        if hf['filename'] =~ /\%/
          warnings << "DC url #{dc_file_path} finds Haplo file with % in filename: #{hf['filename']}"
        end
      end
      unless hf
        warnings << "DC url #{dc_file_path}: can't find Haplo file"
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
digital_commons_hostname = URI(OLD_URL_HTTPS).hostname
File.open("app#{haplo_info["applicationId"]}-oai-pmh-mapping.tsv", "w") do |m|
  haplo_info["outputs"].each do |object|
    if object['dcUrl']
      output_metadata_path = object['dcUrl'].gsub(OLD_URL_HTTP+'/', '').gsub(OLD_URL_HTTPS+'/', '')
      faculty_code = output_metadata_path.split('/')[0]
      info = digital_commons_info.find { |record| record['url'] == object['dcUrl'] }
      article_number = info['fulltext_url'].gsub(OLD_URL_HTTPS, '').gsub(OLD_URL_HTTP, '').
        gsub("/context/#{faculty_code}/article/", "").
        gsub("/viewcontent", "")
      m.puts "oai:#{digital_commons_hostname}:#{faculty_code}-#{article_number}\toai:#{haplo_hostname}:#{object['ref']}"
    end
  end
end

SITEMAPS = [
  [OLD_URL_HTTPS, "app#{haplo_info["applicationId"]}-sitemap.old.xml", 0, /\A\/(id\/eprint\/)?\d+\z/],
  ['https://'+haplo_hostname, "app#{haplo_info["applicationId"]}-sitemap.new.xml", 1]
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
