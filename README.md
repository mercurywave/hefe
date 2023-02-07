# hefe

[GitHub Pages](https://mercurywave.github.io/hefe/)

## example

```ts
Split("|")
b << Sum
    Piece(",", 3) >> ToInt
Filter
    Split(",") >> Idx(1) >> Contains("foo")
Join // assumes \n to join

a << stream // stream is a special variable
b << a:replace(",","_") // run a function on a specific variable
replace("|", "\n") // or run it on the stream

fn Splitter("|")
    SplitEscaped("|", "\|")

op IntSum
    Sum
        Doop 
        ToInt

pattern Line
    number
    ","
    string
    ","
    or
        escapedString("\"")
        string
    ","
```