module github.com/ephem-sh/debugger/examples/go/chi

go 1.25.0

require (
	github.com/ephem-sh/debugger/packages/ephem-debugger-go v0.0.0
	github.com/go-chi/chi/v5 v5.2.5
)

replace github.com/ephem-sh/debugger/packages/ephem-debugger-go => ../../../packages/debugger-go
