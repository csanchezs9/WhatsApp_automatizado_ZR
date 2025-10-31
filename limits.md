Limitación de frecuencia de la app
Última actualización: Fri Oct 31 2025 12:48:37 GMT-0500 (hora estándar de Colombia)
Información sobre la limitación de frecuencia de la app
La limitación de frecuencia define límites sobre la cantidad de llamadas que pueden realizarse a la API en un período concreto. Los límites de frecuencia de la app se aplican a las llamadas realizadas con otro token de acceso que no sea el de una página y a llamadas de las API de anuncios. El número total de llamadas que puede realizar la app por hora es 200 veces el número de usuarios. Ten en cuenta que no es un límite por usuario. Cualquier usuario puede realizar más de 200 llamadas por hora, siempre que el total de los usuarios no supere el máximo de la app.
En esta página se proporcionan datos de limitación de frecuencia aproximados para que puedas administrar los límites de frecuencia.

Límites de frecuencia
Un límite de frecuencia es el número de llamadas a la API que puede realizar una app o un usuario en un período determinado. Si se supera este límite o los límites de CPU o de tiempo total, es posible que se aplique una restricción a la app o al usuario. Las solicitudes a la API hechas por un usuario o una app a los que se aplicó una limitación no funcionarán.

Todas las llamadas a la API están sujetas a límites de frecuencia. Las solicitudes a la API Graph están sujetas a los límites de frecuencia de la plataforma, mientras que las solicitudes a la API de marketing y a la plataforma de Instagram están sujetas a los límites de frecuencia de caso de uso comercial (BUC).

Las solicitudes a la API de páginas están sujetas a los límites de frecuencia de la plataforma o de BUC en función del token utilizado en la solicitud: las solicitudes realizadas con tokens de acceso de la aplicación o de usuario están sujetas a los límites de frecuencia de la plataforma, mientras que las solicitudes realizadas con tokens de usuario de sistema o de acceso a la página están sujetas a los límites de frecuencia de BUC.

Las estadísticas de uso de límites de frecuencia en tiempo real se describen en los encabezados incluidos en la mayoría de las respuestas de la API una vez que se realizó un número de llamadas suficiente a un extremo. Las estadísticas de uso de límites de frecuencia de la plataforma también se muestran en el panel de apps. Una vez alcanzado el límite de frecuencia, todas las solicitudes posteriores realizadas por la app producen un error, y la API devuelve un código de error hasta que haya pasado el tiempo necesario para que el recuento de llamadas se ubique por debajo del límite.

En los casos en los que es posible aplicar límites de frecuencia de la plataforma y de BUC a una solicitud, se aplican los límites de frecuencia de BUC.

Límites de frecuencia de la plataforma
Los límites de frecuencia de la plataforma se someten a seguimiento en el nivel de cada app o usuario, en función del tipo de token utilizado en la solicitud.

Aplicaciones
Las solicitudes de la API Graph realizadas con token de acceso de la aplicación se tienen en cuenta para el límite de frecuencia de esa app. Este recuento de llamadas es el número de llamadas que una app puede realizar durante un intervalo móvil de una hora y se calcula de la siguiente manera:

Calls within one hour = 200 * Number of Users
El número de usuarios se basa en el número de usuarios activos por día únicos que tiene la app. En los casos en los que hay períodos con un uso diario menor (por ejemplo, si una app tiene mucha actividad los fines de semana y menos actividad los demás días), se utilizan los usuarios activos por semana y por mes para calcular la cantidad de usuarios de la app. Las apps con un nivel de interacción diario alto tienen límites de frecuencia superiores a los de aquellas con menos interacción, independientemente de la cantidad efectiva de instalaciones de la app.

Ten presente que no se trata de un límite por usuario, sino de un límite a las llamadas realizadas por tu app. Cada usuario puede hacer más de 200 llamadas por hora con tu app, siempre y cuando el total de llamadas de la app no supere el máximo permitido para la app. Por ejemplo, si tu app tiene 100 usuarios, puede hacer 20.000 llamadas por hora. Sin embargo, es posible que 19.000 de esas llamadas correspondan a tus 10 usuarios más activos.

Usuarios
Las solicitudes a la API Graph realizadas con un token de acceso de usuario se tienen en cuenta para el recuento de llamadas de ese usuario. Ese recuento de llamadas es el número de llamadas que puede realizar el usuario durante un intervalo continuo de una hora. Por motivos relacionados con la privacidad, no revelamos los valores reales del recuento de llamadas de los usuarios.

Ten presente que el recuento de llamadas de un usuario puede distribuirse en varias apps. Por ejemplo, un usuario puede hacer X llamadas mediante App1 e Y llamadas mediante App2. Si X+Y supera el recuento de llamadas máximo, se aplica un límite de frecuencia al usuario. Eso no significa necesariamente que haya un problema en la app. Es posible que el usuario esté utilizando varias apps o que esté utilizando la API incorrectamente.

Encabezados
Los puntos de conexión que reciban una cantidad suficiente de llamadas de la app incluyen un encabezado HTTP X-App-Usage o X-Ad-Account-Usage (en el caso de las llamadas a la versión 3.3 o versiones anteriores de la API de anuncios) en sus respuestas. El encabezado contiene una cadena con formato JSON que describe el uso del límite de frecuencia de la app actual.

Contenido del encabezado

Clave	Descripción del valor
call_count

Un número entero que expresa el porcentaje de llamadas que hizo tu app en un período continuo de una hora.

total_cputime

Un número entero que expresa el porcentaje de tiempo de CPU asignado al procesamiento de consultas.

total_time

Un número entero que expresa el porcentaje de tiempo total asignado al procesamiento de consultas.

Contenido de encabezado X-Ad-Account-Usage
Clave	Descripción del valor
acc_id_util_pct

El porcentaje de llamadas realizadas de esta cuenta publicitaria antes de alcanzar la limitación de frecuencia.

reset_time_duration

La duración (en segundos) que se tarda en restablecer la limitación de frecuencia actual a 0.

ads_api_access_tier

Los niveles permiten que la app acceda a la API de marketing. De modo predeterminado, las apps se ubican en el nivel development_access, mientras que el Standard_access permite lograr una limitación de frecuencia menor. Para obtener una limitación de frecuencia más alta y llegar al nivel estándar, puedes solicitar el "Acceso Avanzado" a la característica Acceso estándar de gestión de anuncios.

Tiempo de CPU total
La cantidad de tiempo de CPU total necesaria para procesar la solicitud. Cuando total_cputime llega a 100, es posible que se aplique un límite a las llamadas.

Tiempo total
El tiempo total necesario para procesar la solicitud. Cuando total_time llega a 100, es posible que se aplique un límite a las llamadas.

Valor de ejemplo de encabezado X-App-Usage
x-app-usage: {
    "call_count": 28,         //Percentage of calls made 
    "total_time": 25,         //Percentage of total time
    "total_cputime": 25       //Percentage of total CPU time
}
Valor de ejemplo de encabezado X-Ad-Account-Usage
x-ad-account-usage: {
    "acc_id_util_pct": 9.67,   //Percentage of calls made for this ad account.
    "reset_time_duration": 100,   //Time duration (in seconds) it takes to reset the current rate limit score.
    "ads_api_access_tier": 'standard_access'   //Tiers allows your app to access the Marketing API. standard_access enables lower rate limiting.
}
Panel
El panel de apps muestra el número de usuarios de la app a los que se aplicó un límite de frecuencia, el porcentaje actual de uso de los límites de frecuencia de la app. Además, muestra la actividad promedio de los últimos siete días. En la tarjeta Límite de frecuencia de la aplicación, haz clic en Ver detalles y pasa el mouse por cualquier punto del gráfico para ver más detalles sobre el uso en ese momento. Como el uso depende del volumen de llamadas, es posible que el gráfico no muestre siete días. Las apps con un volumen de llamadas mayor muestran más días.

Códigos de error
Si una app o un usuario alcanza su límite de frecuencia, las solicitudes realizadas por esa app o ese usuario se completan, y la API responde con un código de error.

Códigos de error de limitación

Código de error	Descripción
4

Indica que la app cuyo token se utiliza en la solicitud alcanzó su límite de frecuencia.

17

Indica que el usuario cuyo token se utiliza en la solicitud alcanzó su límite de frecuencia.

17 with subcode 2446079

Indica que el token que se utiliza en la solicitud a la versión 3.3 o versiones anteriores de la API de anuncios alcanzó su límite de frecuencia.

32

Indica que el usuario o la app cuyo token se utiliza en la solicitud a la API de páginas alcanzó su límite de frecuencia.

613

Indica que se alcanzó un límite de frecuencia personalizado. Para resolver este problema, consulta la documentación de la API específica a la que realizas las llamadas, donde se presentan los límites de frecuencia personalizados que podrían aplicarse.

613 with subcode 1996

Indica que detectamos un comportamiento incoherente en el volumen de solicitudes a la API de tu app. Si hiciste cambios recientemente que afecten la cantidad de solicitudes a la API, es posible que veas este error.

Ejemplo de respuesta
{
  "error": {
    "message": "(#32) Page request limit reached",
    "type": "OAuthException",
    "code": 32,
    "fbtrace_id": "Fz54k3GZrio"
  }
}
Códigos de limitaciones de estabilidad de Facebook

Código de error	Descripción
throttled

Si la consulta tiene limitación o no. Valores: True, False

backend_qps

Primer factor de limitación backend_qps. Valores admitidos:

actual_score: backend_qps real de esta app. Valor: 8
limit: límite backend_qps de esta app. Valor: 5
more_info: las consultas deben manejar un número grande de solicitudes de backend. Sugerimos enviar menos consultas o simplificar las consultas con rangos de tiempo menores, menos identificadores de objetos u otras alternativas.
complexity_score

Segundo factor de limitación complexity_score. Valores admitidos:

actual_score: complexity_score real de esta app. Valor: 0.1
limit: límite complexity_score de esta app. Valor: 0.01
more_info: un límite complexity_score elevado implica que tus solicitudes son muy complejas y solicitan grandes volúmenes de datos. Sugerimos simplificar las consultas con rangos de tiempo más cortos, menos identificadores de objetos, métricas o desgloses, y otras alternativas. Divide consultas grandes y complejas en varias más pequeñas y haz que estén espaciadas.
Prácticas recomendadas
Si se alcanza el límite, deja de hacer llamadas a la API. Si sigues haciendo llamadas, el recuento de llamadas no dejará de aumentar, lo que incrementará la cantidad de tiempo que debe pasar antes de que las llamadas vuelvan a realizarse correctamente.
Distribuye las consultas de forma pareja para evitar los picos de tráfico.
Utiliza filtros a fin de limitar el tamaño de la respuesta de datos y evitar llamadas que requieren la superposición de datos.
Consulta el encabezado HTTP X-App-Usage para determinar a qué distancia está la app del límite y cuándo puedes volver a hacer llamadas cuando se alcance el límite.
Si se aplican limitaciones a los usuarios, asegúrate de que tu app no sea la causa. Reduce las llamadas del usuario o distribúyelas de forma más pareja a lo largo del tiempo.
Límites de frecuencia de caso de uso comercial
Todas las solicitudes a la API de marketing y a la API de páginas realizadas con un token de usuario de sistema o de acceso a la página están sujetas a los límites de frecuencia de caso de uso comercial (BUC) y dependen de los extremos que consultes.

En el caso de la API de marketing, el límite de frecuencia se aplica a la cuenta publicitaria en el mismo caso de uso comercial. Por ejemplo, todos los puntos de conexión con el caso de uso comercial de la administración de anuncios compartirán la cuota total dentro de la misma cuenta publicitaria. Si un determinado punto de conexión realiza muchas solicitudes a la API y causa limitaciones, otros puntos de conexión configurados con el mismo caso de uso comercial también recibirán errores de limitación. La cuota depende del nivel de acceso de la API de marketing de la app. El nivel de acceso estándar de la API de marketing tendrá más cuotas que el nivel de acceso de desarrollo de la API de marketing. De manera predeterminada, una nueva app debería estar en el nivel de desarrollo. Si necesitas obtener más cuota de limitación de frecuencia, actualiza a acceso avanzado en Acceso estándar de administración de anuncios en la revisión de apps.

Estadísticas de anuncios
Administración de anuncios
Catálogo
Público personalizado
Plataforma de Instagram
Generación de clientes potenciales
Messenger
Páginas
Administración de efectos de comercio de Spark AR
API de administración de WhatsApp Business
Estadísticas de anuncios
Las solicitudes realizadas por tu app a la API de estadísticas de anuncios se toman en cuenta en las métricas de limitación de frecuencia de la app, como el recuento de llamadas, el tiempo total de CPU y el tiempo total. Este recuento de llamadas es el número de llamadas que una app puede realizar durante un intervalo continuo de una hora, y se calcula de la siguiente manera:

En el caso de apps con acceso estándar a la función de acceso estándar de administración de anuncios:

Calls within one hour = 600 + 400 * Number of Active ads - 0.001 * User Errors
En el caso de las apps con acceso avanzado a la función de acceso estándar de administración de anuncios:

Calls within one hour = 190000 + 400 * Number of Active ads - 0.001 * User Errors
El número de anuncios activos es el número de anuncios en circulación en cada cuenta publicitaria. Los errores de usuarios se refieren al número de errores recibidos al realizar llamadas a la API. A fin de obtener un límite de frecuencia más alto, puedes enviar una solicitud para usar la función de acceso estándar a la administración de anuncios.

La limitación de frecuencia también puede estar sujeta al tiempo total de CPU y al tiempo real transcurrido durante un intervalo continuo de una hora. Para obtener más detalles, consulta el encabezado X-Business-Use-Case HTTP total_cputime y total_time.

Si recibes errores de límite de frecuencia, también puedes consultar estimated_time_to_regain_access en el encabezado X-Business-Use-Case para conocer el tiempo estimado de bloqueo.

Administración de anuncios
Las solicitudes realizadas por tu app a la API de administración de anuncios se toman en cuenta en las métricas limitación de frecuencia de esta, como el recuento de llamadas, el tiempo total de CPU y el tiempo total. Este recuento de llamadas es el número de llamadas que una app puede realizar durante un intervalo continuo de una hora, y se calcula de la siguiente manera:

En el caso de las apps con acceso estándar a la función de acceso estándar de administración de anuncios:

Calls within one hour = 300 + 40 * Number of Active ads
En el caso de las apps con acceso avanzado a la función de acceso estándar de administración de anuncios:

Calls within one hour = 100000 + 40 * Number of Active ads
El número de anuncios activos es el número de anuncios de cada cuenta publicitaria.

El límite de frecuencia también puede estar sujeto al tiempo total de CPU y al tiempo real transcurrido durante un intervalo continuo de una hora. Para obtener más detalles, consulta el encabezado X-Business-Use-Case HTTP total_cputime y total_time.

Si recibes errores de límite de frecuencia, también puedes consultar estimated_time_to_regain_access en el encabezado X-Business-Use-Case para conocer el tiempo estimado de bloqueo.

Catálogo
Lote de catálogos
Las solicitudes que realiza tu app se descuentan de las métricas de limitación de frecuencia, como el recuento de llamadas, el tiempo total de CPU y el tiempo total que tu app puede hacer en un período continuo de un minuto por cada identificador del catálogo y se calcula de la siguiente manera:

Calls within one minute = 8 + 8 * log2(DA impressions + PDP visits)
"DA impressions" y "PDP visits" son el número de impresiones de anuncios dinámicos y visitas a la página de detalles del producto del catálogo individual con intención en los últimos 28 días. Cuantos más usuarios vean los productos de tu catálogo, mayor será la cuota de llamadas que se asigna.

Tipo de llamada	Punto de conexión
POST

/{catalog_id}/items_batch

POST

/{catalog_id}/localized_items_batch

POST

/{catalog_id}/batch

Administración de catálogos
Las solicitudes que realiza tu app se descuentan de la cantidad de llamadas que esta puede hacer en un período continuo de una hora por cada identificador del catálogo y se calculan de la siguiente manera:

Calls within one hour = 20,000 + 20,000 * log2(DA impressions + PDP visits)
"DA impressions" y "PDP visits" son el número de impresiones de anuncios dinámicos y visitas a la página de detalles del producto del negocio (en todos los catálogos) con intención en los últimos 28 días. Cuantos más usuarios vean los productos de tu catálogo, mayor será la cuota de llamadas que se asigna.

Esta fórmula se aplica en varios puntos de conexión de catálogos.

Para obtener más información sobre cómo obtener el uso de frecuencia actual, consulta Encabezados.

La limitación de frecuencia también puede estar sujeta al tiempo total de CPU y al tiempo real transcurrido durante un intervalo continuo de una hora. Para obtener más detalles, consulta el encabezado X-Business-Use-Case HTTP total_cputime y total_time.

Si recibes errores de límite de frecuencia, también puedes consultar estimated_time_to_regain_access en el encabezado X-Business-Use-Case para conocer el tiempo estimado de bloqueo.

Público personalizado
Las solicitudes hechas por tu app a la API de público personalizado se cuentan con las métricas de limitación de frecuencia de esta, como el recuento de llamadas, el tiempo total de CPU y el tiempo total. El recuento de llamadas de una app es el número de llamadas que puede hacer durante un intervalo continuo de una hora y se calcula de la siguiente manera, pero nunca superará las 700.000:

En el caso de apps con acceso estándar a la función de acceso estándar de administración de anuncios:

Calls within one hour = 5000 + 40 * Number of Active Custom Audiences
En el caso de las apps con acceso avanzado a la función de acceso estándar de administración de anuncios:

Calls within one hour = 190000 + 40 * Number of Active Custom Audiences
El número de públicos personalizados activos es el número de públicos personalizados activos de cada cuenta publicitaria.

La limitación de frecuencia también puede estar sujeta al tiempo total de CPU y al tiempo real transcurrido durante un intervalo continuo de una hora. Para obtener más detalles, consulta el encabezado X-Business-Use-Case HTTP total_cputime y total_time.

Si recibes errores de límite de frecuencia, también puedes consultar estimated_time_to_regain_access en el encabezado X-Business-Use-Case para conocer el tiempo estimado de bloqueo.

Plataforma de Instagram
Calls to the Instagram Platform endpoints, excluding messaging, are counted against the calling app's call count. An app's call count is unique for each app and app user pair, and is the number of calls the app has made in a rolling 24 hour window. It is calculated as follows:

Calls within 24 hours = 4800 * Number of Impressions
The Number of Impressions is the number of times any content from the app user's Instagram professional account has entered a person's screen within the last 24 hours.

Notes
Business Discovery and Hashtag Search API are subject to Platform Rate Limits.
Messaging Rate Limits
Calls to the Instagram messaging endpoints are counted against the number of calls your app can make per Instagram professional account and the API used.

Conversations API
Your app can make 2 calls per second per Instagram professional account.
Private Replies API
Your app can make 100 calls per second per Instagram professional account for private replies to Instagram Live comments
Your app can make 750 calls per hour per Instagram professional account for private replies to comments on Instagram posts and reels
Send API
Your app can make 100 calls per second per Instagram professional account for messages that contain text, links, reactions, and stickers
Your app can make 10 calls per second per Instagram professional account for messages that contain audio or video content
Generación de clientes potenciales
Las solicitudes realizadas por tu app a la API de generación de clientes potenciales se tienen en cuenta en el recuento de llamadas de la app. Ese recuento de llamadas es el número de llamadas que puede realizar durante un intervalo continuo de 24 horas y se calcula de la siguiente manera:

Calls within 24 hours = 4800 * Leads Generated
El número de clientes potenciales generados es el número de clientes potenciales generados por página en la cuenta publicitaria en los últimos 90 días.

Plataforma de Messenger
Los límites de frecuencia de la plataforma de Messenger dependen de la API utilizada y, en algunos casos, del contenido del mensaje.

API de Messenger
Las solicitudes que realiza tu app se descuentan de la cantidad de llamadas que esta puede hacer en un plazo de 24 horas seguidas y se calculan de la siguiente manera:

Calls within 24 hours = 200 * Number of Engaged Users
El número de usuarios que interactúan es la cantidad de personas a las que la empresa puede enviar mensajes mediante Messenger.

API de Messenger para Instagram
Las solicitudes que realiza tu app se descuentan de la cantidad de llamadas que esta puede hacer por cuenta de Instagram profesional y la API utilizada.

API de conversaciones

Tu app puede hacer2 llamadas por segundo, por cuenta de Instagram profesional.
API de envío

Tu app puede hacer 100 llamadas por segundo, por cuenta de Instagram profesional, en el caso de los mensajes que contienen texto, enlaces, reacciones y stickers.
Tu app puede hacer 10 llamadas por segundo, por cuenta de Instagram profesional, en el caso de los mensajes que contienen audio o video.
API de respuestas privadas

Tu app puede hacer 100 llamadas por segundo, por cuenta de Instagram profesional, en el caso de las respuestas privadas a comentarios de Instagram Live.
Tu app puede hacer 750 llamadas por hora, por cuenta de Instagram profesional, en el caso de las respuestas privadas a comentarios en publicaciones y reels de Instagram.
Páginas
Los límites de frecuencia de la página pueden usar la lógica de límites de frecuencia de la plataforma o de BUC, según el tipo de token utilizado. Toda llamada a la API de páginas realizada con un token de acceso a la página o un token de acceso de usuario de sistema utiliza el cálculo de límite de frecuencia que se describe a continuación. Toda llamada hecha con un token de acceso de la aplicación o un token de acceso de usuario está sujeta a los límites de frecuencia de la aplicación o de usuario.

Las solicitudes realizadas por tu app a la API de páginas con un token de acceso a la página o un token de acceso de usuario de sistema se tienen en cuenta para el recuento de llamadas de la app. Ese recuento de llamadas es el número de llamadas que puede realizar durante un intervalo continuo de 24 horas y se calcula de la siguiente manera:

Calls within 24 hours = 4800 * Number of Engaged Users
El número de usuarios que interactúan es el número de usuarios que interactuaron con la página en 24 horas.

Las solicitudes que realiza tu app a la API de páginas mediante un token de acceso de usuario o un token de acceso a la app están sujetas a la lógica de límites de frecuencia de la plataforma.

Para evitar problemas de limitación de frecuencia al usar la función de contenido de acceso público a páginas, se recomienda usar un token de acceso de usuario del sistema.

Administrador de efectos de comercio de Spark AR
Las solicitudes realizadas por tu app a los puntos de conexión de comercio se tienen en cuenta para el recuento de llamadas de la app. Este recuento de llamadas es el número de llamadas que una app puede realizar durante un intervalo continuo de una hora, y se calcula de la siguiente manera:

Calls within one hour = 200 + 40 * Number of Catalogs
La cantidad de catálogos es la cantidad total de catálogos en todas las cuentas de comercio que administra tu app.

Threads
Las llamadas a la API de Threads se incluirán en el conteo de llamadas de la app que las realiza. El conteo de llamadas de una app es exclusivo de cada app y cada par app-usuario, y es el número de llamadas que hizo la app en un intervalo móvil de 24 horas. Se calcula de la siguiente manera:
Llamadas en 24 horas = 4.800 * número de impresiones
El número de impresiones es el número de veces que el contenido de la cuenta de Threads del usuario de la app apareció en la pantalla de una persona en las últimas 24 horas. La limitación de frecuencia también puede estar sujeta al tiempo de CPU total por día:
720.000 * número de impresiones en el tiempo de CPU total
2.880.000 * número de impresiones en el tiempo total
Nota: El valor mínimo para las impresiones es 10 (si el valor es inferior a 10, se asigna un valor predeterminado de 10).
API de administración de WhatsApp Business
Las solicitudes realizadas por tu app a la API de administración de WhatsApp Business se tienen en cuenta en el recuento de llamadas de la app. El recuento de llamadas es el número de llamadas que se puede realizar durante un período continuo de una hora. En el caso de la siguiente API de administración de WhatsApp Business, de manera predeterminada, tu app puede realizar 200 llamadas por hora, por app, por cuenta de WhatsApp Business (WABA). Con las WABA activas, que tienen al menos un número de teléfono registrado, tu app puede hacer 5.000 llamadas por hora, por app, por WABA activa.
Tipo de llamada	Punto de conexión
GET

/{whatsapp-business-account-id}

GET, POST y DELETE

/{whatsapp-business-account-id}/assigned_users

GET

/{whatsapp-business-account-id}/phone_numbers

GET, POST y DELETE

/{whatsapp-business-account-id}/message_templates

GET, POST y DELETE

/{whatsapp-business-account-id}/subscribed_apps

GET

/{whatsapp-business-account-to-number-current-status-id}

En las siguientes API de línea de crédito, tu app puede hacer 5.000 llamadas por hora, por app.
Tipo de llamada	Punto de conexión
GET

/{business-id}/extendedcredits

POST

/{extended-credit-id}/whatsapp_credit_sharing_and_attach

GET y DELETE

/{allocation-config-id}

GET

/{extended-credit-id}/owning_credit_allocation_configs

Para evitar alcanzar los límites de frecuencia, recomendamos usar webhooks, con el objetivo de hacer un seguimiento de las actualizaciones de estado de las plantillas de mensajes, los números de teléfono y las WABA.

Para obtener más información sobre cómo obtener el uso actual del límite, consulta Encabezados.
Encabezados
Todas las respuestas a la API realizadas por tu app a las que se haya aplicado un límite de frecuencia con la lógica de BUC incluyen un encabezado HTTP X-Business-Use-Case-Usage (en el caso de las llamadas a la versión 3.3 de la API de anuncios y versiones anteriores) con una cadena en formato JSON que describe el uso actual del límite de frecuencia de la aplicación. Ese encabezado puede devolver hasta 32 objetos por llamada.

Contenido del encabezado de uso X-Business-Use-Case
Código de error	Descripción del valor
business-id

El identificador del negocio asociado con el token que realiza las llamadas a la API.

call_count

Un número entero que expresa el porcentaje de llamadas permitidas que hizo tu app en un período continuo de una hora.

estimated_time_to_regain_access

El tiempo, expresado en minutos, que debe pasar hasta que las llamadas dejen de limitarse.

total_cputime

Un número entero que expresa el porcentaje de tiempo de CPU asignado al procesamiento de consultas.

total_time

Un número entero que expresa el porcentaje de tiempo total asignado al procesamiento de consultas.

type

Tipo de límite de frecuencia aplicado. El valor puede ser uno de los siguientes: ads_insights, ads_management, custom_audience, instagram, leadgen, messenger o pages.

ads_api_access_tier

Solo se aplica a los tipos ads_insights y ads_management. Los niveles permiten que la app acceda a la API de marketing. De modo predeterminado, las apps se ubican en el nivel development_access, mientras que el Standard_access permite lograr una limitación de frecuencia menor. Para obtener una limitación de frecuencia más alta y llegar al nivel estándar, puedes solicitar el "Acceso Avanzado" a la característica Acceso estándar de gestión de anuncios.

Tiempo de CPU total
El tiempo de CPU total necesario para procesar la solicitud. Cuando total_cputime llega a 100, es posible que se aplique un límite a las llamadas.

Tiempo total
La cantidad de tiempo total necesaria para procesar la solicitud. Cuando total_time llega a 100, es posible que se aplique un límite a las llamadas.

Nivel de acceso a la API de anuncios
Solo se aplica a los tipos ads_insights y ads_management. Los niveles permiten que la app acceda a la API de marketing. De modo predeterminado, las apps se ubican en el nivel development_access, mientras que el Standard_access permite lograr una limitación de frecuencia menor. Para obtener una limitación de frecuencia más alta y llegar al nivel estándar, puedes solicitar el "Acceso Avanzado" a la característica Acceso estándar de gestión de anuncios.

Valor de ejemplo del encabezado X-Business-Use-Case-Usage
x-business-use-case-usage: {
    "{business-object-id}": [
        {
            "type": "{rate-limit-type}",           //Type of BUC rate limit logic being applied.
            "call_count": 100,                     //Percentage of calls made. 
            "total_cputime": 25,                   //Percentage of the total CPU time that has been used.
            "total_time": 25,                      //Percentage of the total time that has been used.   
            "estimated_time_to_regain_access": 19,  //Time in minutes to regain access.
            "ads_api_access_tier": "standard_access"  //Tiers allows your app to access the Marketing API. standard_access enables lower rate limiting.
        }
    ],      
    "66782684": [
        {
            "type": "ads_management",
            "call_count": 95,
            "total_cputime": 20,
            "total_time": 20,
            "estimated_time_to_regain_access": 0,
            "ads_api_access_tier": "development_access" 
        }
    ],
    "10153848260347724": [
        {
            "type": "ads_insights",
            "call_count": 97,
            "total_cputime": 23,
            "total_time": 23,
            "estimated_time_to_regain_access": 0,
            "ads_api_access_tier": "development_access"
        }
    ],
    "10153848260347724": [
        {
            "type": "pages",
            "call_count": 97,
            "total_cputime": 23,
            "total_time": 23,
            "estimated_time_to_regain_access": 0
        }
    ],
...
}
Códigos de error
Una vez que tu app alcanza el límite de frecuencia de BUC, las solicitudes posteriores realizadas por la app producen un error, y la API responde con un código de error.

Código de error	Tipo de límite de frecuencia de BUC
error code 80000, error subcode 2446079

Estadísticas de anuncios

error code 80004, error subcode 2446079

Administración de anuncios

error code 80003, error subcode 2446079

Público personalizado

error code 80002

Instagram

error code 80005

Generación de clientes potenciales

error code 80006

Messenger

error code 32	
Llamadas a la página realizadas con un token de acceso de usuario

error code 80001	
Llamadas a la página realizadas con un token de acceso a la página o de usuario del sistema

error code 17, error subcode 2446079

Versión 3.3 y anteriores de la API de anuncios, que excluyen las estadísticas de anuncios

error code 80008

API de administración de WhatsApp Business

error code 80014

Lote de catálogos

error code 80009

Administración de catálogos

Ejemplo de mensaje de código de error
{   
"error": {      
    "message": "(#80001) There have been too many calls to this Page account. Wait a bit and try again. For more info, please refer to https://developers.facebook.com/docs/graph-api/overview/rate-limiting.",      
    "type": "OAuthException",      
    "code": 80001,      
    "fbtrace_id": "AmFGcW_3hwDB7qFbl_QdebZ"   
    }
}
Prácticas recomendadas
Si se alcanza el límite, deja de hacer llamadas a la API. Si sigues haciendo llamadas, el recuento de llamadas no dejará de aumentar, lo que incrementará la cantidad de tiempo que debe pasar antes de que las llamadas vuelvan a realizarse correctamente.
Consulta el encabezado HTTP X-Business-Use-Case-Usage para determinar a qué distancia está la cuenta del límite y cuándo puedes volver a hacer llamadas.
Verifica el código de error y el extremo de la API para confirmar el tipo de limitación.
Cambia a otras cuentas publicitarias y vuelve a esta cuenta más tarde.
Es mejor crear un anuncio nuevo que cambiar los existentes.
Distribuir las consultas de manera uniforme entre dos intervalos de tiempo para evitar generar picos de tráfico.
Utiliza filtros a fin de limitar el tamaño de la respuesta de datos y evitar llamadas que requieran la superposición de datos.
Preguntas frecuentes
¿Qué consideramos una llamada a la API?
Todas las llamadas cuentan para los límites de frecuencia, no solo las solicitudes a API específicas. Por ejemplo, puedes hacer una sola solicitud a la API en la que se especifiquen varios identificadores, pero cada identificador cuenta como una llamada.

El concepto se ilustra en la siguiente tabla.

Solicitudes de ejemplo	Cantidad de llamadas a la API
GET https://graph.facebook.com/photos?ids=4

GET https://graph.facebook.com/photos?ids=5
GET https://graph.facebook.com/photos?ids=6

3

GET https://graph.facebook.com/photos?ids=4,5,6

3

Te recomendamos enfáticamente que, siempre que sea posible, especifiques varios identificadores en una sola solicitud a la API, ya que eso mejora el rendimiento de las respuestas de la API.

Estoy creando una herramienta de extracción; ¿hay algo más que deba saber?
Si estás creando un servicio que extrae datos, lee nuestras condiciones de extracción.


LINK
https://developers.facebook.com/docs/graph-api/overview/rate-limiting#application-level-rate-limiting