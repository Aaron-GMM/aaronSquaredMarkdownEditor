package main

import (
	"context" // Adicionado para o hook de shutdown
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
		Title:     "Aaron²",
		Width:     1024,
		Height:    768,
		Frameless: true, // 🌟 MÁGICA: Remove as bordas feias do Windows/Linux
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 23, B: 42, A: 1}, // Cor "Slate 900" moderna
		OnStartup:        myApp.Startup,
		OnShutdown: func(ctx context.Context) {
			log.Println("Encerrando Aaron²... Limpando processos zumbis.")
			myApp.StopTerminal()
		},
		Bind: []interface{}{
			myApp,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
