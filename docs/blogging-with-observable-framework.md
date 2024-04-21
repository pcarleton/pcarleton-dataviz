---
title: Blogging with Observable Framework
---

**tl;dr** The "new" Observable Framework is a neat way to write markdown while more easily inserting javascript, visualizations, and interactivity. It doesn't integrate well with blogging (it's targeting dashboard use cases), but with some creativity, can be jammed into a Hugo site. I don't think I'll do this regularly unless I really go bananas with writing posts in observable.

### In the beginning, there were notebooks

I've been a long time user of Observable, specifically the Observable Notebooks on observablehq.com. You can read a bit about those in some [previous]() [posts](). The two things that really drew me into this model were:
* a super fast feedback loop
* super easy interactivity

**Reactivity** The layout is similar to what you might know from IPython/Jupyter notebooks, with cells that you execute. There are a few things that make the feedback loop even tighter in Observable that like, most notably the reactivity. It acts like a spreadsheet where it tracks data dependencies, so any downstream cell is re-executed if you change one of its dependencies.

**Interactivity** Adding sliders, input boxes, and drop downs, are all super easy. You can write HTML itself, or use the nice builtin inputs library. Combined with the reactivity, this makes for some really cool data visualization opportunities.  My favorite creation was adjusting the delta-v of a rocket burn using a slider, and seeing if it resulted in a successful orbital rendezvous (try it out [here]())

### Enter the framework
Lately, Observable has changed their focus to be a framework that can be used outside of their web UI, and can generate statically host-able sites. It's supposed to keep the same tight feedback loop, but also integrate more nicely with all the tools folks use regularly, like source control. I'm just dipping my toes into this, and the rest of this post is going to be about trying to write some posts.

# Goal: An Observable Framework report in a Hugo site
This blog is (currently) hosted as a [Render]() static site, written using Markdown, and rendered as HTML using [Hugo](). Here's what I wanted to do:

1. Write this post using markdown
2. Use Observable's dev view to get the live preview
3. Add some javascript and interactivity
4. Slot it in as a "normal" Hugo post

## Using some Observable features

```js echo
const phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌑"];
const phasePick = view(Inputs.range([0, phases.length - 1], {label: "Phase #", step: 1, value: 0}))
```

```js echo
phases[phasePick]
```

And how about an auto-play slider:

```js echo
import Scrubber from "./components/Scrubber.js"
const scrubIdx = view(Scrubber([...phases.keys()], {autoplay: false, delay: 100}));
```

```js echo
html`<h2> ${phases[scrubIdx]}</h2>`
```

## Inserting it into Hugo

I have a list of posts in Hugo, and I want to see how easy it would be to just drop in a post that uses the Observable Framework.  Another option would be to treat all my existing Hugo posts as Observable Framework posts instead. Since there are a decent number of them (60 or so), and I don't want to go all-in on Observable Framework yet, I'll see about just inserting one Observable post.

### Attempt #1: Copy the `dist` folder, use Caddy

The first thing I tried was running `yarn build` in the Observable directory, and then copying the resulting `dist` folder into Hugo's `public` folder under an `obs` folder name.

This sort of works. It won't work with Hugo's built in server (`hugo server`) since it doesn't like that folder name, but if you instead point `caddy` at the public folder, it's happy to server the content.  The one caveat is that links don't work. e.g. going to `/obs/blogging-with-observable-framework` 404's, but `/obs/blogging-with-observable-framework.html` (adding `.html` at the end) does work.  Adding a `try_files` directive fixed this.

Caddyfile:
```Caddyfile
localhost:4242 {
	# Set webroot
	root * ./public
	# Enable the static file server.
	file_server
	try_files {path}.html
}
```

The issues with this set up are that the the posts don't show up as blog posts in the main page, kind of defeating the purpose of doing this in the first place. As in, why not just host 2 different blogs and cross link them?

### Attempt #2: A placeholder post with surgery

Another option is to start with a placeholder post to get all the Hugo machinery working, but then surgically insert the actual Observable content.

This works fairly well with the proper surgery, but also seems the most prone to breaking, cuts against the grain of both tools, and requires the most tooling to get to work.  Without some additional work, it would also involve duplicating all of the JS files required in every post that uses Observable Framework.

The things I needed to do were:
1. Copy all the `<link>`'s (except for style.css ones, since I'm using my Hugo theme)
2. Copy the `<main>` over, although merging classes / ID's and re-inserting an `<article>`
3. Copy the whole `obs` embedded folder (so all NPM modules etc.)

It seems like this could almost work with some static templating from Hugo, and then basically just being able to write Observable Framework stuff straight into the markdown. However, the benefits provided by Framework, involve automatically figuring out your imports and packaging etc. so you'd have to run basically both tool chains and then a follow up munging step.


## Conclusion

It seems like it'd be better to separately host data things from pure blogging things for now, as it's not a simple drag-and-drop situation to put a Framework report into a Hugo blog.


## Misc thoughts


### Remixability
In Notebooks, it's all "right there", there's no "inspect element" to do because any HTML you add is visible as an `html` cell. When looking at some of the examples for Observable Framework, it's not as easy. This is a tradeoff because most of the time you don't actually want to see all of those cells, so it makes a notebook look "cluttered", but it makes understanding the details of a particular demo kind of annoying. 

### Importing other notebooks (Scrubber)

https://github.com/observablehq/framework/issues/1128

To get [`Scrubber`](https://observablehq.com/@mbostock/scrubber) to work:
1. I copied the "implementation" cell locally as Scrubber.js component
2. Added imports for `html` and `Inputs`
3. Added an export statement
4. Imported from `./components/Scrubber.js`

Here were the imports I added:

```
import {html} from "npm:htl";
import * as Inputs from "npm:@observablehq/inputs";
```
(Note re ^ -- since I just did \`\`\`, and not \`\`\`js, it's just a normal code block, it doesn't execute, but it also means I don't get syntax highlighting...)


TODO:
- [ ] link to those, figure out relative linking /absolute etc.
