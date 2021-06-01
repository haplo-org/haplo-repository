#!/usr/bin/env ruby

# Haplo Research Manager                            https://haplo.org
# (c) Haplo Services Ltd 2006 - 2021           https://www.haplo.com
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#
# usage:
#    jruby scripts/make-new-repository.rb prefix "ShortName" "Full Name" "Import Route"
#
# This will generate a new client_repository plugin in clients/prefix. Eg...
#
#    jruby scripts/make-new-repository.rb uoe "UoE" "University of Example" "ePrints"
#    jruby scripts/make-new-repository.rb uoe "UoE" "University of Example" "Digital Commons"
#

PREFIX, SHORTNAME, FULLNAME, IMPORTROUTE = ARGV

raise "Bad full name" unless FULLNAME && FULLNAME =~ /\A[a-zA-Z0-9 ]+\z/
raise "Bad short name" unless SHORTNAME && SHORTNAME =~ /\A[a-zA-Z0-9 ]+\z/
raise "Short name isn't short" if SHORTNAME.length >= FULLNAME.length
raise "Bad prefix" unless PREFIX && PREFIX =~ /\A[a-z]+\z/
raise "Bad import route. Valid import routes: ePrints, Digital Commons." unless !IMPORTROUTE || ["ePrints", "Digital Commons"].include?(IMPORTROUTE)

OUTPUT_DIR = File.expand_path("#{File.dirname(__FILE__)}/../../clients/#{PREFIX}")
INPUT_DIR = File.expand_path("#{File.dirname(__FILE__)}/template")

puts <<__E
prefix: #{PREFIX}
short name: #{SHORTNAME}
full name: #{FULLNAME}
output directory: #{OUTPUT_DIR}

__E

# ---------------------------------------------------------------------------

require 'fileutils'

unless(File.exist?(OUTPUT_DIR))
    Dir.mkdir(OUTPUT_DIR)
end

def create_template_plugin_maybe(plugin)
  unless(File.exist?("#{OUTPUT_DIR}/#{PREFIX}_#{plugin}"))
    path = "#{INPUT_DIR}/repotemplate_#{plugin}";
    Dir.glob(path+"/**/*.*").sort.each do |filefullname|
      filename = filefullname.sub("#{INPUT_DIR}/",'')
      if filename =~ /\Arepotemplate/
        dest = filename.gsub('repotemplate', PREFIX)
        puts sprintf("%-60s -> %s", filename, dest)

        contents = File.read(filefullname)
        contents.gsub!('repotemplate', PREFIX)
        contents.gsub!('TmplUni', SHORTNAME)
        contents.gsub!('TemplateUniversity', FULLNAME)
        if(IMPORTROUTE)
          contents.gsub!('repository_import_method', 'hres_repo_'+IMPORTROUTE.downcase.gsub(" ", "_"))
        else
          contents.gsub!(/\n(\r)?.*repository_import_method.*/, '')
        end;
        if filename =~ /plugin\.json\z/
          secret = File.open("/dev/random") { |f| f.read(20) }
          contents.gsub!(/"installSecret":\s*".+?"/, %Q!"installSecret": "#{secret.unpack('H*').join}"!)
        end

        fulldest = "#{OUTPUT_DIR}/#{dest}"
        FileUtils.mkdir_p(File.dirname(fulldest))
        File.open(fulldest,"w") { |f| f.write contents }
      end
    end
  end
end

create_template_plugin_maybe("application")
create_template_plugin_maybe("repository")

if(IMPORTROUTE == "ePrints")
  create_template_plugin_maybe("eprints")
elsif(IMPORTROUTE === "Digital Commons")
  create_template_plugin_maybe("digital_commons")
end


unless(File.exist?("#{OUTPUT_DIR}/workspace.json"))
  File.open("#{OUTPUT_DIR}/workspace.json", "w") do |f|
    f.write <<__E
{
  "autoUninstallPlugins": true,
  "search": [
    {
        "path": ".",
        "name": "#{FULLNAME}"
    },
    {
        "path": "../../repository",
        "name": "Haplo RM Repository"
    },
    {
        "path": "../../hres",
        "name": "Haplo Research Manager",
        "obtain": "Clone https://github.com/haplo-org/haplo-research-manager"
    },
    {
        "path": "../../haplo-plugins",
        "name": "Haplo Plugins",
        "obtain": "Clone https://github.com/haplo-org/haplo-plugins"
    }
  ]
}
__E
  end
end
