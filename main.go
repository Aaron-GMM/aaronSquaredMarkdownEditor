package main

import (
	"embed"
	"log"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/app"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	myApp := app.NewApp()

	err := wails.Run(&options.App{
		Title:  "Aaron²",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1}, // Dark theme
		OnStartup:        myApp.Startup,
		Bind: []interface{}{
			myApp,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
