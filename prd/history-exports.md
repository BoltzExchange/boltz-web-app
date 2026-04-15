# History exports

Due to the increasing complexity and number of edge cases, we decided to
remove the backup import feature and replace it with a simple history
export. To rescue or resume pending swaps, we already have native rescue
functionality, so importing historical swaps is a niche use case. It also
introduces problems such as reliably reproducing all state, maintaining
backwards compatibility with the file format, and requiring the rescue key
to be included.
