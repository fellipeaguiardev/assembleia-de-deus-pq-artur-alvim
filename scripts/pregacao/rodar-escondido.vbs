' Roda o programa da pregação sem abrir janela (usado pelo Agendador de Tarefas).
' Argumento: caminho do node.exe.
Dim sh, pasta, node
Set sh = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
node = "node"
If WScript.Arguments.Count > 0 Then node = WScript.Arguments(0)
sh.Run """" & node & """ """ & pasta & "\rodar.mjs""", 0, True
