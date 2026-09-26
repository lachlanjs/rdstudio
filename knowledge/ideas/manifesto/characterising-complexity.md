---
type: Idea
title: Characterising Complexity
description: How do we think about complex systems and mapping knowledge?
tags: [manifesto, learning]
generated: { by: "human:lachlan", at: 2026-09-10T15:12:00Z }
---

---

The intelligent way to navigate uncharted territory is to equip yourself with a map. The map must come in a format which strikes a balance between readability/interpretability and detail. 

The following maps are of no use:

- Unreadable because it is too detailed
- So abstract that it offers no insight
- Inappropriate scale

As an example, codebases are *complex* because they work at a variety of scales:

- The scale of individual instructions
- The scale of individual functions
- The scale of interacting classes and objects
- The scale of modules and dependencies
- The orchestration of major features

This list is not exhaustive and is aimed at the particular example of a codebase. Other scales, systems, and components exist and may be individual to each project. Identifying these is a core part of the exercise of understanding what you are dealing with.

These scales can be seen as independent systems in their own right, while also interacting and fundamentally depending on each other. This is precisely what makes something "complex" according to a definition preferred and pioneered by scientists globally (especially those at the Santa Fe Institute for whom complexity is the central topic of study).

Therefore, truly understanding a complex project demands an intimate identification and understanding of each of these separate scales, as well as an understanding of how the scales interrelate.

To take the analogy literally, one can zoom out all the way on Google Maps to see the scale of continents (the high level organisation of Earth) - then zoom in to see countries, and their borders - then zoom in again to see a country's system of cities interconnected by road, rail, waterways, and so forth - then further yet again to cities, infrastructure, and so on yet again. Each of these scales can be analysed in their own right, and yet adjacent scales also exhibit interplay. Google Maps fundamentally serves you a tilemap at a scale and resolution matching your zoom level (XYZ format) and is thus built naturally around this phenomenon.

Achieving this level of understanding will not only improve our own relationship with our projects, but it will also enhance their capacity to grow in the right directions through decision making guided by clarity and foundational structure.

It should be noted that this is the case not only for our own understanding, but it can be done in a way that also assists AI systems. If we do this now, then we can seed AI training data with this human and machine parity. If we were alternatively to continue as we are, building without developing our understanding at an equal rate, then this will become the norm that AI is trained within.

## Do not confuse the landscape or the vehicle for traversal with the map

In the case of a codebase, a map is not your IDE. It is not a filesystem explorer, or a fuzzy finder. These are vehicles of traversal, but they are not mechanisms for achieving greater internal understanding.

A map synthesizes a landscape into a more digestible format. Think of the satellite view of Google Maps compared to the aptly named "map" view.

There is a phenomenon in which practitioners build very fast and flashy vehicles for traversing their projects, and these can be useful, but they do not themselves build a better understanding of the landscape.

## The Act of Building *does* Chart the Map, however...

As those with expertise building complex projects prior to AI will understand, building a project by yourself will imbue you with a fundamental, intimate and unassailable level of understanding of that project. It would be tempting then to espouse the notion that this is the only way to achieve this understanding. It is not.

One notices that the act of building is like exploring a landscape bit by bit. It naturally charts the landscape within your own mind.
However, excepting for the circumstances of best practices of documentation being applied, it does not produce a map outside of the creator's own mind that others can digest.

## Charting is not a Prerequisite for Digesting a Map

It is perhaps obvious to say that charting a map yourself is not the only way to obtain an intimate understanding of the map. Sometimes you are just given the map. We know this from times where we have been initiated into a project which we did not originate ourselves. This is also the case with projects initiated with the lifting substantially carried out by AI.

The obvious trick we have available to us is to use AI tooling to build a map in a format that is digestible to us as a human (which carries the ancillary benefit of also helping the AI maintain a consistent and coherent picture of the project).

## A network is *almost* the right model

We witness today a dogma of network science which is confined to representing only one scale. That is, our typical network has nodes representing fundamental constituents and edges connecting them representing their relationships. At a certain number of nodes and edges, these networks become extremely unwieldy; jointly difficult to understand internally, as well as represent visually. In a word, spaghettification.

It is quite interesting in fact that a large part of network science is devoted to divining this granular *community structure* from a network represented at the most fine and multitudinous scale. We find ourselves doing this unnecessarily and unproductively in the case of understanding complex projects. We are afforded the freedom of directly modeling these different scales if we choose.

As pointed out, the complex systems that we care about are actually best thought of as systems at various scales. We are left not with a single network but with a hierarchy of networks. 

An excellent example of this misdirected thinking is exhibited in the trend of Personal Knowledge Management (PKM). Individuals employ network modelling as a form of notekeeping as a tool for achieving understanding of complex things. Notes become nodes interconnected by wikilinks. One fantasises about a carefully curated web of organised thought. Practically however, as all who have attempted this will have noticed, this starts to fall over as the number of notes becomes large. The network representation loses clarity and focus. 

A remedy for this is to augment the representation of the network with this hierarchy as a fundamental part of its representation. The hierarchy acts as a mechanism by which to cull connections which are too far reaching conceptually. Identifying which connections are too far reaching and which are not helps characterise the synthesis of the overall project. 

An oasis might have a direct influence on the living organisms directly supported by the oasis, but it does not bear any interactive relationship to the oasis 10 kilometres away - thus these things should not be related as they are separated by scale, despite being of the same scale order.

On the other hand, if a bird is living in a tree on a mountain - then the bird and the tree and the mountain may be modeled as different objects, but they exist on different orders, and it would be inappropriate to interconnect them as though they deserved to exist on the same scale. Rather, the bird should nest within the tree, and the tree should nest within the mountain, and that should be it.

## Proposed Intervention: A Better Representation

Fortunately we can be creative and extend our visual representation of networks around varying nested scales if we so choose.

Google's OKF format comes with directory structure as a fundamental component. We can represent each directory as a bubble, with immediate descendant .md files and directories as nested bubbles and nodes which may interconnect.

Connections to nodes and bubbles elsewhere may exist but they will not be as intimately represented. It will take some experimentation to find the right way of doing this.

The representation could be initially constructed through the use of AI, with refinement by a human. 

## Proposed Intervention: Extracting Insight from this Representation

Network Science has sought to find structure within network representations for a long time. Some nodes are more critical than others. This could be indicated by their degree (although in some instances such as a TOC this might be a red herring, which could be avoided through frontmatter declarations), or their ability to facilitate longer paths through the network. More advanced mathematical insights also exist such as analysing the graph Laplacian, adjacency matrix spectrum, or PageRank algorithms.

A network (no less, one imbued with the as yet colloquially unfamiliar introduction of hierarchy) is a complicated and non-linear object. Insights such as those above could help linearise the process of digesting this network. For example, which nodes are most critical to the overall project, or an ordering of which nodes are most important to understand first.

These insights may support the endeavour of building understanding. 
