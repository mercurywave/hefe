# hefe

[GitHub Pages](https://mercurywave.github.io/hefe/)

## example

```ts
Split("|")
b := Sum
    Piece(",", 3) >> ToInt
Filter
    Split(",") >> Idx(1) >> Contains("foo")
Join("\n")

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