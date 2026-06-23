using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

internal static class Program
{
    private const string Host = "127.0.0.1";
    private const int Port = 8765;

    private static int Main()
    {
        string executableDir = AppDomain.CurrentDomain.BaseDirectory;
        string projectRoot = Path.GetFullPath(Path.Combine(executableDir, ".."));
        string serverScript = Path.Combine(projectRoot, "scripts", "server.py");
        string indexFile = Path.Combine(projectRoot, "index.html");

        if (!File.Exists(serverScript) || !File.Exists(indexFile))
        {
            ShowError(
                "Nao encontrei os arquivos do sistema.",
                "Mantenha este executavel dentro da pasta Executavel do projeto TRANSLOG."
            );
            return 1;
        }

        string url = "http://" + Host + ":" + Port + "/";
        bool alreadyRunning = IsPortOpen();

        if (!alreadyRunning)
        {
            if (!StartServer(projectRoot, serverScript))
            {
                ShowError(
                    "Nao foi possivel iniciar o servidor local.",
                    "Confira se o Python esta instalado e disponivel no Windows."
                );
                return 2;
            }

            if (!WaitForServer())
            {
                ShowError(
                    "O servidor nao respondeu em tempo suficiente.",
                    "Tente abrir o projeto pelo terminal: python scripts/server.py --host 127.0.0.1 --port 8765"
                );
                return 3;
            }
        }

        OpenBrowser(url);
        return 0;
    }

    private static bool StartServer(string projectRoot, string serverScript)
    {
        try
        {
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = "python",
                Arguments = "\"" + serverScript + "\" --host " + Host + " --port " + Port,
                WorkingDirectory = projectRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(info);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool WaitForServer()
    {
        for (int attempt = 0; attempt < 30; attempt++)
        {
            if (IsPortOpen()) return true;
            Thread.Sleep(350);
        }
        return false;
    }

    private static bool IsPortOpen()
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                IAsyncResult result = client.BeginConnect(Host, Port, null, null);
                bool connected = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
                if (!connected) return false;
                client.EndConnect(result);
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void OpenBrowser(string url)
    {
        try
        {
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            };
            Process.Start(info);
        }
        catch
        {
            Console.WriteLine("Abra manualmente: " + url);
        }
    }

    private static void ShowError(string title, string detail)
    {
        Console.Error.WriteLine(title);
        Console.Error.WriteLine(detail);
        try
        {
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = "cmd",
                Arguments = "/c echo " + title + " & echo " + detail + " & pause",
                UseShellExecute = true
            };
            Process.Start(info);
        }
        catch
        {
            // Console output above is enough when a message window cannot be opened.
        }
    }
}
