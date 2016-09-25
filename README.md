# jaxsnoop
AJAX web-crawler based on nodejs and slimerjs

Nothing works, project still in its first stages.


## TODO list

Getting the global oriented graph of web-app web-state for all users

- constructing web-state for one user without trigerring events

    - preprocessing of each downloaded web-page
        - function of downloading web-page in slimer and wait for its full load
        - function of looking through loaded by slimer web-page and generating tree of clickable elements and some of their characteristis. tree must correlate with web-page DOM
        - function, which will decide if the targeted DOM-element is clickable by user. Create some base of identificators for such elements.

    - write primitive graph-library with functions:

        - graph must contain in itself spanning tree in explicit form
        - function for adding and removing nodes
        - function of applying specified func to all nodes
        - function of searching for vertex with specified by some func properties
        - function for searching the path from one vertex to another and to search from initial vertex to another

    - creation of data structure (oriented graph) to store captured DOM and its clickables after preprocessing

    - crawling without triggering state-changing clickables

        - function for selecting clickable from graph (first of all from current web-page) (or reload other page - function for reloading) to be triggered to get into new state, preprocess it, add to graph, etc.
        - function-handler of new queries to web-server to stop web-server state-changing clickables, if smth blocked - mark loaded web-page as unconsistent

    - add to preprocessing

        - function for detecting similarities

            between:
                
            - stored DOM-pages
            - elements of DOM-pages

            sub-functions:

            - fragmentation of current web-page into potential duplicate elements
            - function for fragmentation of other web-pages
            - function for comparison of currently loaded web-page with previously loaded and extracting the diffences

                - several rules must be written
                - comparison must be done with appropriate ignoring of web-page content

            - function for calculation of tree edit distance with considering of some content

            - in case of detecting similarities, they must be moved into separated vertex of oriented graph

- functions in slimer and nodejs for passing user web-states oriented graphs into nodejs (serialization/deserialization)

- analyzing global users web-state

    - adapting oriented graph-library from slimerjs to nodejs 
    - writing serialization and deserialization of collected global web-states

    - function for adding global users web-state into oriented graph of site web-states

        - function to compare currently gotten global web-state with previously recorded for deteting already known states

    - function for selecting some web-state changing clickable.
    - function for passing the selected choice of changing clickable to appropriate slimerjs (with according user) and
        
        function in slimerjs to load necessary web-page state and trigger the clickable

    - function to make an order to slimer crawlers for gathering new users web-state

    - adding stopping requirements (amount of time, or amount of states, etc.)

- adding functional to slimer crawlers of one users web-state

    - function of checking if user is still logged in

After getting graph, basing on the same code-base must be written crawler for authorization vulnerabilities:

Slimerjs crawlers for per-users web-state will be the same

- getting current global users web-state and searching in oriented graph the current position

- selecting the clickable of interest in the oriented graph

- changing the current global state into the state of interest (after searching the path in oriented graph) (through passing the sequence of commands to slimerjs crawlers with appropriate user role)

- passing the command to slimerjs to click the clickable of interest and getting the answer

- function of classifying the answer, if it succeeded, if yes - writing a bug report for user (writing the hole path in oriented graph of global web-states)

improving the software:

- add various blacklists and whitelists as an option