s195-graph
==========
A likes API implementation for Sports195 using restify, neo4j, redis and firebase.

Requirements
------------
1. nodejs
1. A local Neo4j Release Candidate 1 or greater database http://www.neo4j.org/download
1. A local redis 

To run
-------
1. Startup redis `redis-server`
1. Startup neo4j. `neo4j start` to daemonize, `neo4j console` to not.
1. Run `npm install`.
1. I needed to tweak the node neo4j bindings, so `cd node_modules/neo4j`.
1. Run `npm install` followed by `npm run build` to compile the coffeescript.
1. Run `grunt dev` to start up the dev server.

